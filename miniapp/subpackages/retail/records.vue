<template>
  <view class="page retail-records">
    <view class="head">
      <view>
        <view class="eyebrow">零售模块</view>
        <view class="title">零售记录</view>
      </view>
      <button class="soft-button refresh-button" :disabled="loading" @click="loadOrders">{{ loading ? '读取中' : '刷新' }}</button>
    </view>

    <view class="soft-card filter-card">
      <view class="top-filter-row">
        <picker :value="modeIndex" :range="modeOptions" range-key="label" @change="changeMode">
          <view class="input picker">{{ modeOptions[modeIndex].label }}</view>
        </picker>
        <input v-model.trim="customer" class="input" placeholder="搜索客户" @input="reloadFirstPage" />
      </view>
      <picker v-if="mode === 'day'" mode="date" :value="day" @change="changeDay">
        <view class="input picker">日期：{{ day }}</view>
      </picker>
      <view v-if="mode === 'range'" class="range-row">
        <picker mode="date" :value="startDate" @change="changeStartDate">
          <view class="input picker">{{ startDate }}</view>
        </picker>
        <text>至</text>
        <picker mode="date" :value="endDate" @change="changeEndDate">
          <view class="input picker">{{ endDate }}</view>
        </picker>
      </view>
      <view class="status-filter">
        <view
          v-for="item in statusOptions"
          :key="item.value"
          class="status-option"
          :class="{ active: status === item.value }"
          @click="changeStatus(item.value)"
        >
          {{ item.label }}
        </view>
      </view>
    </view>

    <view class="summary-card">
      <view>
        <view class="summary-label">总金额</view>
        <view class="summary-money">¥{{ money(summary.totalAmount) }}</view>
      </view>
      <view class="summary-side">
        <view>已付 ¥{{ money(summary.paidAmount) }}</view>
        <view>未付 ¥{{ money(summary.unpaidAmount) }}</view>
      </view>
    </view>

    <view v-if="loading" class="soft-card empty">正在读取记录...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>
    <view v-else>
      <view v-for="order in orders" :key="order.id" class="record-card" @click="openDetail(order.id)">
        <view>
          <view class="customer-name">{{ order.customerName }}</view>
          <view class="record-meta">{{ timeText(order.createdAt) }} · {{ order.itemCount }}件商品</view>
        </view>
        <view class="record-side">
          <view class="amount">¥{{ money(order.totalAmount) }}</view>
          <view class="status" :class="order.status">{{ retailStatusText(order.status) }}</view>
          <button
            v-if="order.status !== 'paid'"
            class="pay-button"
            :disabled="payingId === order.id"
            @click.stop="markPaid(order)"
          >
            {{ payingId === order.id ? '处理中' : '付清' }}
          </button>
        </view>
      </view>
      <view v-if="!orders.length" class="soft-card empty-state">暂无零售记录</view>
      <view class="pager">
        <button class="pager-button" :disabled="page <= 1 || loading" @click="changePage(page - 1)">上一页</button>
        <text>{{ page }} / {{ totalPages }}</text>
        <button class="pager-button" :disabled="page >= totalPages || loading" @click="changePage(page + 1)">下一页</button>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money, timeText, todayText } from '../../utils/format'
import { retailStatusText } from './constants'

const today = todayText()

export default {
  data() {
    return {
      mode: 'day',
      day: today,
      startDate: today,
      endDate: today,
      customer: '',
      status: 'all',
      modeOptions: [
        { label: '今天', value: 'day' },
        { label: '当月', value: 'month' },
        { label: '全部时间', value: 'all' },
        { label: '选择时间', value: 'range' }
      ],
      statusOptions: [
        { label: '全部', value: 'all' },
        { label: '未付', value: 'unpaid' },
        { label: '已付', value: 'paid' }
      ],
      orders: [],
      summary: { totalAmount: 0, paidAmount: 0, unpaidAmount: 0 },
      page: 1,
      pageSize: 4,
      totalPages: 1,
      loading: false,
      error: '',
      payingId: '',
      timer: null
    }
  },
  computed: {
    modeIndex() {
      const index = this.modeOptions.findIndex(item => item.value === this.mode)
      return index < 0 ? 0 : index
    }
  },
  onShow() {
    if (requireLogin()) this.loadOrders()
  },
  onUnload() {
    if (this.timer) clearTimeout(this.timer)
  },
  methods: {
    money,
    timeText,
    retailStatusText,
    changeMode(event) {
      this.mode = this.modeOptions[Number(event.detail.value)].value
      this.reloadFirstPage()
    },
    changeDay(event) {
      this.day = event.detail.value
      this.reloadFirstPage()
    },
    changeStartDate(event) {
      this.startDate = event.detail.value
      if (this.startDate > this.endDate) this.endDate = this.startDate
      this.reloadFirstPage()
    },
    changeEndDate(event) {
      this.endDate = event.detail.value
      if (this.endDate < this.startDate) this.startDate = this.endDate
      this.reloadFirstPage()
    },
    changePage(page) {
      this.page = page
      this.loadOrders()
    },
    changeStatus(status) {
      this.status = status
      this.reloadFirstPage()
    },
    reloadFirstPage() {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => {
        this.page = 1
        this.loadOrders()
      }, 220)
    },
    openDetail(id) {
      uni.navigateTo({ url: `/subpackages/retail/detail?id=${id}` })
    },
    async loadOrders() {
      this.loading = true
      this.error = ''
      try {
        const params = [
          `mode=${this.mode}`,
          `day=${this.day}`,
          `startDate=${this.startDate}`,
          `endDate=${this.endDate}`,
          `page=${this.page}`,
          `pageSize=${this.pageSize}`,
          `status=${this.status}`
        ]
        if (this.customer) params.push(`customer=${encodeURIComponent(this.customer)}`)
        const result = await request({ url: `/api/retail/orders?${params.join('&')}` })
        this.orders = result.items || []
        this.totalPages = result.totalPages || 1
        this.summary = result.summary || { totalAmount: 0, paidAmount: 0, unpaidAmount: 0 }
      } catch (err) {
        this.orders = []
        this.error = err.message || '零售记录读取失败'
      } finally {
        this.loading = false
      }
    },
    markPaid(order) {
      uni.showModal({
        title: '确认付清？',
        content: `${order.customerName} ¥${money(order.totalAmount)}`,
        confirmText: '付清',
        success: async (res) => {
          if (!res.confirm) return
          this.payingId = order.id
          try {
            await request({ url: `/api/retail/orders/${order.id}/pay`, method: 'PATCH' })
            uni.showToast({ title: '已付清', icon: 'success' })
            this.loadOrders()
          } finally {
            this.payingId = ''
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 18rpx 8rpx 14rpx;
}

.eyebrow {
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
}

.title {
  margin-top: 8rpx;
  color: #17362f;
  font-size: 42rpx;
  font-weight: 900;
}

.refresh-button {
  width: 132rpx;
  height: 58rpx;
  min-height: 58rpx;
  background: #e8f6ed;
  color: #166b4e;
}

.filter-card {
  display: grid;
  gap: 12rpx;
  padding: 14rpx;
}

.picker {
  display: flex;
  align-items: center;
}

.top-filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12rpx;
  align-items: center;
}

.range-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42rpx minmax(0, 1fr);
  gap: 10rpx;
  align-items: center;
  color: #718078;
  text-align: center;
}

.status-filter {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}

.status-option {
  height: 58rpx;
  border-radius: 16rpx;
  background: #edf6ee;
  color: #52635b;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 58rpx;
  text-align: center;
}

.status-option.active {
  background: #16945f;
  color: #ffffff;
}

.summary-card {
  display: flex;
  justify-content: space-between;
  margin: 0 0 16rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #16a66c 0%, #0f7d55 100%);
  color: #ffffff;
}

.summary-label,
.summary-side {
  font-size: 24rpx;
  font-weight: 800;
}

.summary-money {
  margin-top: 10rpx;
  font-size: 40rpx;
  font-weight: 900;
}

.summary-side {
  display: grid;
  gap: 10rpx;
  align-content: center;
  text-align: right;
}

.record-card {
  display: flex;
  justify-content: space-between;
  gap: 14rpx;
  margin-bottom: 14rpx;
  padding: 18rpx;
  border: 2rpx solid #d7ead9;
  border-radius: 18rpx;
  background: #ffffff;
}

.customer-name {
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
}

.record-meta {
  margin-top: 8rpx;
  color: #718078;
  font-size: 24rpx;
}

.record-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10rpx;
  min-width: 260rpx;
  text-align: right;
}

.amount {
  color: #d64b3f;
  font-size: 30rpx;
  font-weight: 900;
}

.status {
  color: #d64b3f;
  font-size: 23rpx;
  font-weight: 900;
}

.status.paid {
  color: #16945f;
}

.pay-button {
  width: 112rpx;
  height: 50rpx;
  min-height: 50rpx;
  border-radius: 15rpx;
  background: #16945f;
  color: #ffffff;
  font-size: 23rpx;
  font-weight: 900;
}

.pay-button[disabled] {
  opacity: 0.7;
}

.pager {
  display: grid;
  grid-template-columns: 150rpx minmax(0, 1fr) 150rpx;
  gap: 16rpx;
  align-items: center;
  padding: 12rpx 8rpx 28rpx;
  color: #17362f;
  font-weight: 900;
  text-align: center;
}

.pager-button {
  height: 58rpx;
  min-height: 58rpx;
  border-radius: 16rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
}

.empty,
.empty-state {
  color: #718078;
  text-align: center;
}

.error {
  color: #d64b3f;
}

.retail-records {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(11, 154, 135, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f2fffb 0%, #e7fbf6 100%);
}

.soft-card,
.record-card,
.filter-card,
.summary-card {
  border-color: #bde5df;
  background: linear-gradient(145deg, #ffffff 0%, #effdfa 100%);
}

.section-title,
.record-name,
.pager {
  color: #0d4d45;
}

.amount,
.profit,
.status.paid,
.pager-button {
  color: #0b9a87;
}

.status.paid,
.pager-button {
  background: #dff6f1;
}

.pay-button {
  background: #0b9a87;
}
</style>
