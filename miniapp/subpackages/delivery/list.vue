<template>
  <view class="page delivery-list">
    <view class="soft-card filter-card">
      <view class="date-wrap">
        <picker :value="dateIndex" :range="dateOptions" range-key="label" @change="changeDateMode">
          <view class="input picker-input">{{ dateLabel }}</view>
        </picker>
        <picker v-if="dateMode === 'day'" mode="date" :value="date" @change="changeDate">
          <view class="filter-button">换日期</view>
        </picker>
      </view>
      <view v-if="dateMode === 'range'" class="range-wrap">
        <picker mode="date" :value="startDate" @change="changeStartDate">
          <view class="date-change range-date">{{ startDate }}</view>
        </picker>
        <text class="range-sep">至</text>
        <picker mode="date" :value="endDate" @change="changeEndDate">
          <view class="date-change range-date">{{ endDate }}</view>
        </picker>
      </view>
      <picker :value="statusIndex" :range="statusOptions" range-key="label" @change="changeStatus">
        <view class="input picker-input">{{ statusLabel }}</view>
      </picker>
      <input v-model="marketName" class="input search-input" placeholder="超市名称" confirm-type="search" @confirm="reload" />
    </view>

    <view class="soft-card list-card">
      <view class="title-row">
        <view class="section-title">超市订单</view>
        <view class="count">共{{ pagination.total }}单</view>
      </view>

      <view v-if="loading" class="empty">正在读取订单...</view>
      <view v-else-if="error" class="empty error">{{ error }}</view>
      <view v-else>
        <view v-for="order in orders" :key="order.id" class="order-row" @click="openDetail(order.id)">
          <view class="order-main">
            <text class="market">{{ order.supermarketName }}</text>
            <text class="amount">¥{{ money(order.totalAmount) }}</text>
            <text class="muted time">{{ timeText(order.createdAt) }}</text>
          </view>
          <view class="order-foot">
            <text class="profit" :class="{ loss: Number(order.totalProfit || 0) < 0 }">利润 ¥{{ money(order.totalProfit) }}</text>
            <view class="order-actions">
              <button v-if="order.status === 'active'" class="pay-button" @click.stop="payOrder(order)">结账</button>
              <text class="status" :class="order.status">{{ statusText(order.status) }}</text>
            </view>
          </view>
        </view>
        <view v-if="!orders.length" class="empty">没有超市订单</view>

        <view v-if="pagination.totalPages > 1" class="pager">
          <button class="pager-button" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">上一页</button>
          <picker :value="pageIndex" :range="pageOptions" range-key="label" @change="selectPage">
            <view class="pager-current">第 {{ pagination.page }} / {{ pagination.totalPages }} 页</view>
          </picker>
          <button class="pager-button" :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">下一页</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money, timeText, todayText } from '../../utils/format'

export default {
  data() {
    const today = todayText()
    return {
      date: today,
      startDate: today,
      endDate: today,
      dateMode: 'day',
      status: '',
      marketName: '',
      orders: [],
      pagination: {
        page: 1,
        pageSize: 6,
        total: 0,
        totalPages: 1
      },
      loading: false,
      error: '',
      dateOptions: [
        { label: '今天', value: 'day' },
        { label: '日期范围', value: 'range' },
        { label: '全部日期', value: 'all' }
      ],
      statusOptions: [
        { label: '全部状态', value: '' },
        { label: '未结', value: 'active' },
        { label: '已结', value: 'paid' },
        { label: '已作废', value: 'cancelled' }
      ]
    }
  },
  computed: {
    dateIndex() {
      const index = this.dateOptions.findIndex(item => item.value === this.dateMode)
      return index < 0 ? 0 : index
    },
    dateLabel() {
      if (this.dateMode === 'all') return '全部日期'
      if (this.dateMode === 'range') return '日期范围'
      return this.date
    },
    statusIndex() {
      const index = this.statusOptions.findIndex(item => item.value === this.status)
      return index < 0 ? 0 : index
    },
    statusLabel() {
      return this.statusOptions[this.statusIndex].label
    },
    pageIndex() {
      return Math.max(this.pagination.page - 1, 0)
    },
    pageOptions() {
      return Array.from({ length: this.pagination.totalPages }, (_, index) => ({
        label: `第 ${index + 1} 页`,
        value: index + 1
      }))
    }
  },
  onShow() {
    if (requireLogin()) this.loadOrders()
  },
  methods: {
    money,
    timeText,
    statusText(status) {
      if (status === 'paid') return '已结'
      if (status === 'cancelled') return '已作废'
      return '未结'
    },
    changeDateMode(event) {
      this.dateMode = this.dateOptions[Number(event.detail.value)].value
      this.reload()
    },
    changeDate(event) {
      this.date = event.detail.value
      this.dateMode = 'day'
      this.reload()
    },
    changeStartDate(event) {
      this.startDate = event.detail.value
      if (this.startDate > this.endDate) this.endDate = this.startDate
      this.dateMode = 'range'
      this.reload()
    },
    changeEndDate(event) {
      this.endDate = event.detail.value
      if (this.endDate < this.startDate) this.startDate = this.endDate
      this.dateMode = 'range'
      this.reload()
    },
    changeStatus(event) {
      this.status = this.statusOptions[Number(event.detail.value)].value
      this.reload()
    },
    reload() {
      this.pagination.page = 1
      this.loadOrders()
    },
    changePage(page) {
      const next = Math.min(Math.max(Number(page), 1), this.pagination.totalPages)
      if (next === this.pagination.page) return
      this.pagination.page = next
      this.loadOrders()
    },
    selectPage(event) {
      const option = this.pageOptions[Number(event.detail.value)]
      if (option) this.changePage(option.value)
    },
    async loadOrders() {
      this.loading = true
      this.error = ''
      try {
        const dateParam = this.dateMode === 'all' ? 'all' : (this.dateMode === 'range' ? 'range' : this.date)
        const rangeParams = this.dateMode === 'range'
          ? `&mode=range&startDate=${encodeURIComponent(this.startDate)}&endDate=${encodeURIComponent(this.endDate)}`
          : ''
        const result = await request({
          url: `/api/supermarket-orders?date=${encodeURIComponent(dateParam)}${rangeParams}&supermarketName=${encodeURIComponent(this.marketName.trim())}&status=${encodeURIComponent(this.status)}&page=${this.pagination.page}&pageSize=${this.pagination.pageSize}`
        })
        this.orders = Array.isArray(result) ? result : (result.items || [])
        this.pagination = result.pagination || {
          page: 1,
          pageSize: this.pagination.pageSize,
          total: this.orders.length,
          totalPages: 1
        }
      } catch (err) {
        this.orders = []
        this.error = err.message || '超市订单读取失败'
      } finally {
        this.loading = false
      }
    },
    openDetail(id) {
      uni.navigateTo({ url: `/subpackages/delivery/detail?id=${id}` })
    },
    payOrder(order) {
      uni.showModal({
        title: '确认结账',
        content: `超市：${order.supermarketName}\n总金额：¥${money(order.totalAmount)}`,
        confirmText: '结账',
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/supermarket-orders/${order.id}/pay`, method: 'PATCH' })
          uni.showToast({ title: '已结账', icon: 'success' })
          this.loadOrders()
        }
      })
    }
  }
}
</script>

<style scoped>
.delivery-list {
  min-height: 100vh;
  background:
    radial-gradient(circle at 10% 4%, rgba(255, 191, 63, 0.16), transparent 180rpx),
    radial-gradient(circle at 92% 10%, rgba(22, 148, 95, 0.12), transparent 220rpx),
    linear-gradient(180deg, #f8fbf2 0%, #eef7ed 100%);
}

.filter-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12rpx;
  padding: 16rpx;
  border-color: #dfe8d8;
  background: linear-gradient(145deg, #ffffff 0%, #f6fbf1 100%);
}

.date-wrap {
  position: relative;
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 108rpx;
  gap: 8rpx;
  align-items: center;
  min-width: 0;
}

.range-wrap {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38rpx minmax(0, 1fr);
  gap: 8rpx;
  align-items: center;
}

.range-date {
  width: auto;
}

.range-sep {
  color: #748078;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.filter-card .search-input {
  grid-column: 1 / -1;
}

.picker-input,
.filter-button {
  display: flex;
  align-items: center;
}

.filter-button {
  justify-content: center;
  min-height: 68rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
}

.date-change {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 68rpx;
  min-height: 68rpx;
  padding: 0 8rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
}

.list-card {
  padding: 18rpx;
  border-color: #dfe8d8;
  background: linear-gradient(145deg, #ffffff 0%, #f8fbf4 100%);
}

.title-row,
.order-main,
.order-foot,
.order-actions,
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.count {
  color: #748078;
  font-size: 24rpx;
  font-weight: 900;
}

.order-row {
  margin-bottom: 12rpx;
  padding: 16rpx;
  border: 2rpx solid #dfe8d8;
  border-radius: 16rpx;
  background: linear-gradient(145deg, #ffffff 0%, #fbfdf8 100%);
}

.market {
  max-width: 300rpx;
  overflow: hidden;
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  color: #16945f;
  font-size: 30rpx;
  font-weight: 900;
}

.time {
  display: block;
  margin-top: 8rpx;
}

.order-foot {
  margin-top: 12rpx;
}

.profit {
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
}

.profit.loss {
  color: #d64b3f;
}

.status {
  min-width: 92rpx;
  height: 44rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 44rpx;
  text-align: center;
}

.status.unpaid {
  background: #fff6cf;
  color: #9b6b00;
}

.status.cancelled {
  background: #ffece8;
  color: #d64b3f;
}

.order-actions {
  gap: 10rpx;
}

.pay-button {
  width: 92rpx;
  height: 44rpx;
  min-height: 44rpx;
  border-radius: 12rpx;
  background: #16945f;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 44rpx;
}

.pager {
  justify-content: center;
  padding-top: 8rpx;
}

.pager-button {
  width: 136rpx;
  height: 54rpx;
  min-height: 54rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
}

.pager-current {
  min-width: 190rpx;
  height: 54rpx;
  margin: 0 12rpx;
  border: 2rpx solid #dfe8d8;
  border-radius: 12rpx;
  background: #ffffff;
  color: #17362f;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 54rpx;
  text-align: center;
}

.empty {
  padding: 42rpx 0;
  color: #748078;
  text-align: center;
}

.error {
  color: #d64b3f;
}
</style>
