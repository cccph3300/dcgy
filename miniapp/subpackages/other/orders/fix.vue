<template>
  <view class="page fix-page">
    <view class="fix-head">
      <view>
        <view class="head-label">东成果业</view>
        <view class="head-title">订单改单</view>
      </view>
      <button class="refresh-button" :disabled="loading" @click="loadOrders">{{ loading ? '读取中' : '刷新' }}</button>
    </view>

    <view class="soft-card section-card">
      <view class="section-title">改单查询</view>
      <view class="filter-grid">
        <picker :value="dateIndex" :range="dateOptions" range-key="label" @change="changeDateMode">
          <view class="input picker-input">{{ dateLabel }}</view>
        </picker>
        <input v-model.trim="orderCustomer" class="input" placeholder="搜索客户" @input="reloadFirstPage" />
      </view>
      <view v-if="dateMode === 'day'" class="single-date">
        <picker mode="date" :value="date" @change="changeDate">
          <view class="input picker-input">日期：{{ date }}</view>
        </picker>
      </view>
      <view v-if="dateMode === 'range'" class="range-row">
        <picker mode="date" :value="startDate" @change="changeStartDate">
          <view class="input picker-input">{{ startDate }}</view>
        </picker>
        <text>至</text>
        <picker mode="date" :value="endDate" @change="changeEndDate">
          <view class="input picker-input">{{ endDate }}</view>
        </picker>
      </view>

      <view v-if="loading" class="empty">正在读取订单...</view>
      <view v-else-if="error" class="empty error">{{ error }}</view>
      <view v-else>
        <view v-for="order in orders" :key="order.id" class="order-row" @click="openEdit(order.id)">
          <view>
            <view class="order-name">{{ order.customerName }}</view>
            <view class="muted">{{ timeText(order.createdAt) }} · {{ statusText(order.status) }}</view>
          </view>
          <view class="order-side">
            <view class="order-money">¥{{ money(order.totalAmount) }}</view>
            <view class="edit-text">改单</view>
          </view>
        </view>
        <view v-if="!orders.length" class="empty">没有订单</view>
        <view class="pager">
          <button class="pager-button" :disabled="page <= 1 || loading" @click="changePage(page - 1)">上一页</button>
          <text>{{ page }} / {{ totalPages }}</text>
          <button class="pager-button" :disabled="page >= totalPages || loading" @click="changePage(page + 1)">下一页</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { money, timeText, todayText, statusText } from '../../../utils/format'

const today = todayText()

export default {
  data() {
    return {
      dateMode: 'day',
      date: today,
      startDate: today,
      endDate: today,
      orderCustomer: '',
      orders: [],
      page: 1,
      pageSize: 6,
      totalPages: 1,
      loading: false,
      error: '',
      reloadTimer: null,
      dateOptions: [
        { label: '当日', value: 'day' },
        { label: '日期范围', value: 'range' },
        { label: '全部时间', value: 'all' }
      ]
    }
  },
  computed: {
    dateIndex() {
      const index = this.dateOptions.findIndex(item => item.value === this.dateMode)
      return index < 0 ? 0 : index
    },
    dateLabel() {
      return this.dateOptions[this.dateIndex].label
    }
  },
  onShow() {
    if (!requireLogin()) return
    this.loadOrders()
  },
  onUnload() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer)
  },
  methods: {
    money,
    timeText,
    statusText,
    changeDateMode(event) {
      this.dateMode = this.dateOptions[Number(event.detail.value)].value
      this.reloadFirstPage()
    },
    changeDate(event) {
      this.date = event.detail.value
      this.dateMode = 'day'
      this.reloadFirstPage()
    },
    changeStartDate(event) {
      this.startDate = event.detail.value
      if (this.startDate > this.endDate) this.endDate = this.startDate
      this.dateMode = 'range'
      this.reloadFirstPage()
    },
    changeEndDate(event) {
      this.endDate = event.detail.value
      if (this.endDate < this.startDate) this.startDate = this.endDate
      this.dateMode = 'range'
      this.reloadFirstPage()
    },
    reloadFirstPage() {
      if (this.reloadTimer) clearTimeout(this.reloadTimer)
      this.reloadTimer = setTimeout(() => {
        this.page = 1
        this.loadOrders()
      }, 180)
    },
    changePage(page) {
      this.page = page
      this.loadOrders()
    },
    async loadOrders() {
      this.loading = true
      this.error = ''
      try {
        const dateParam = this.dateMode === 'all' ? 'all' : (this.dateMode === 'range' ? 'range' : this.date)
        const rangeParams = this.dateMode === 'range' ? `&mode=range&startDate=${encodeURIComponent(this.startDate)}&endDate=${encodeURIComponent(this.endDate)}` : ''
        const result = await request({
          url: `/api/orders?date=${encodeURIComponent(dateParam)}${rangeParams}&customer=${encodeURIComponent(this.orderCustomer)}&page=${this.page}&pageSize=${this.pageSize}`
        })
        this.orders = result.items || []
        this.totalPages = result.pagination?.totalPages || 1
      } catch (err) {
        this.orders = []
        this.error = err.message || '订单读取失败'
      } finally {
        this.loading = false
      }
    },
    openEdit(id) {
      uni.navigateTo({ url: `/pages/orders/detail?id=${id}&missed=1` })
    }
  }
}
</script>

<style scoped>
.fix-page {
  padding-bottom: 28rpx;
}

.fix-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 18rpx 8rpx 14rpx;
}

.head-label {
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
}

.head-title {
  margin-top: 8rpx;
  color: #17362f;
  font-size: 42rpx;
  font-weight: 900;
}

.refresh-button,
.pager-button {
  height: 58rpx;
  min-height: 58rpx;
  border-radius: 16rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
}

.refresh-button {
  width: 132rpx;
}

.section-card {
  margin-bottom: 18rpx;
  padding: 16rpx;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.picker-input {
  display: flex;
  align-items: center;
}

.single-date,
.range-row {
  margin-top: 12rpx;
}

.range-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42rpx minmax(0, 1fr);
  gap: 10rpx;
  align-items: center;
  color: #718078;
  font-weight: 900;
  text-align: center;
}

.order-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10rpx;
  align-items: center;
  min-height: 66rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #eef2ee;
}

.order-name {
  overflow: hidden;
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-side {
  display: grid;
  gap: 4rpx;
  text-align: right;
}

.order-money {
  color: #16945f;
  font-weight: 900;
}

.edit-text {
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
}

.pager {
  display: grid;
  grid-template-columns: 150rpx minmax(0, 1fr) 150rpx;
  gap: 16rpx;
  align-items: center;
  padding-top: 16rpx;
  color: #17362f;
  font-weight: 900;
  text-align: center;
}

.empty {
  padding: 28rpx 0;
  color: #718078;
  text-align: center;
}

.error {
  color: #d64b3f;
}
</style>
