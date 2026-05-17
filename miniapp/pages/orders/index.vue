<template>
  <view class="page">
    <view class="soft-card filter-row">
      <view class="date-wrap">
        <picker :value="dateIndex" :range="dateOptions" range-key="label" @change="changeDateMode">
          <view class="input picker-input">{{ dateLabel }}</view>
        </picker>
        <picker v-if="dateMode === 'day'" mode="date" :value="date" @change="changeDate">
          <view class="date-change">{{ text.changeDate }}</view>
        </picker>
      </view>
      <view class="search-wrap">
        <input
          v-model="customer"
          class="input"
          :placeholder="text.customerPlaceholder"
          confirm-type="search"
          @input="onCustomerInput"
          @focus="searchCustomers"
          @confirm="loadOrders"
        />
        <scroll-view v-if="customerSuggestions.length" class="suggest-float" scroll-y enhanced>
          <view
            v-for="item in customerSuggestions"
            :key="item.id"
            class="suggest-item"
            @click="selectCustomer(item)"
          >
            {{ item.name }}
          </view>
        </scroll-view>
      </view>
      <view v-if="dateMode === 'range'" class="range-wrap">
        <picker mode="date" :value="startDate" @change="changeStartDate">
          <view class="date-change range-date">{{ startDate }}</view>
        </picker>
        <text class="range-sep">{{ text.toDate }}</text>
        <picker mode="date" :value="endDate" @change="changeEndDate">
          <view class="date-change range-date">{{ endDate }}</view>
        </picker>
      </view>
    </view>

    <view v-if="selectedCustomerId" class="debt-entry">
      <button class="soft-button primary" @click="openDebt">{{ text.debtButton }}</button>
    </view>

    <view class="soft-card order-card">
      <view class="order-title-row">
        <view class="section-title">{{ text.orderTitle }}</view>
        <view class="order-count">{{ text.totalPrefix }}{{ pagination.total }}{{ text.totalSuffix }}</view>
      </view>
      <view class="summary-row">
        <view class="summary-item">
          <text>{{ text.dayTotal }}</text>
          <text>{{ text.currency }}{{ money(summary.totalAmount) }}</text>
        </view>
        <view class="summary-item paid">
          <text>{{ text.paidTotal }}</text>
          <text>{{ text.currency }}{{ money(summary.paidAmount) }}</text>
        </view>
        <view class="summary-item unpaid">
          <text>{{ text.unpaidTotal }}</text>
          <text>{{ text.currency }}{{ money(summary.unpaidAmount) }}</text>
        </view>
      </view>
      <view v-if="loading" class="empty">{{ text.loading }}</view>
      <view v-else-if="error" class="empty error">{{ error }}</view>
      <view v-else>
        <view v-for="order in orders" :key="order.id" class="order-row" @click="openDetail(order.id)">
          <view class="order-main">
            <text class="name" :class="order.customerClassName">{{ order.customerName }}</text>
            <text class="amount" :class="order.status">{{ text.currency }}{{ money(order.totalAmount) }}</text>
            <text class="muted order-time">{{ dateText(order.createdAt) }} {{ timeOnlyText(order.createdAt) }}</text>
          </view>
          <view class="actions" :class="{ 'paid-actions': order.status !== 'unpaid' }" @click.stop>
            <block v-if="order.status === 'unpaid'">
              <button class="order-action-button success" @click="markPaid(order.id)">{{ text.checkout }}</button>
              <button class="order-action-button danger" @click="cancelOrder(order.id)">{{ text.cancel }}</button>
            </block>
            <text v-else-if="order.status === 'paid'" class="paid-text">{{ text.customerPaid }}</text>
            <text v-else class="status-text cancelled">{{ statusText(order.status) }}</text>
          </view>
        </view>
        <view v-if="!orders.length" class="empty">{{ emptyText }}</view>
        <view v-if="pagination.totalPages > 1" class="pager">
          <button class="pager-button" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">{{ text.prevPage }}</button>
          <picker :value="pageIndex" :range="pageOptions" range-key="label" @change="selectPage">
            <view class="pager-current">{{ text.pagePrefix }} {{ pagination.page }} / {{ pagination.totalPages }} {{ text.pageSuffix }}</view>
          </picker>
          <button class="pager-button" :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">{{ text.nextPage }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { dateText, money, statusText, timeOnlyText, todayText } from '../../utils/format'

const zh = {
  allTime: '\u5168\u90e8\u65f6\u95f4',
  today: '\u4eca\u5929',
  dateRange: '日期范围',
  toDate: '至',
  currency: '\uffe5',
  prevPage: '\u4e0a\u4e00\u9875',
  nextPage: '\u4e0b\u4e00\u9875',
  pagePrefix: '\u7b2c',
  pageSuffix: '\u9875',
  totalPrefix: '\u5171',
  totalSuffix: '\u6761',
  dayTotal: '\u5f53\u65e5\u603b\u8ba1',
  paidTotal: '\u5df2\u4ed8\u6e05',
  unpaidTotal: '\u672a\u4ed8\u6e05',
  changeDate: '\u6362\u65e5\u671f',
  customerPlaceholder: '\u5ba2\u6237\u540d',
  debtButton: '\u751f\u6210\u6b20\u8d26\u5355',
  orderTitle: '\u8ba2\u5355\u8bb0\u5f55',
  loading: '\u6b63\u5728\u8bfb\u53d6\u8ba2\u5355...',
  noOrder: '\u6ca1\u6709\u8ba2\u5355',
  noTodayOrder: '\u5f53\u5929\u6ca1\u6709\u8ba2\u5355',
  checkout: '\u7ed3\u8d26',
  customerPaid: '\u5ba2\u6237\u5df2\u4ed8\u6e05',
  cancel: '\u6bc1\u5355',
  confirmPaid: '\u786e\u8ba4\u7ed3\u8d26\uff1f',
  confirmCancel: '\u786e\u8ba4\u6bc1\u5355\uff1f',
  cancelTip: '\u6bc1\u5355\u540e\u4f1a\u6062\u590d\u5e93\u5b58',
  loadFailed: '\u8ba2\u5355\u8bfb\u53d6\u5931\u8d25'
}

export default {
  data() {
    const today = todayText()
    return {
      text: zh,
      date: today,
      startDate: today,
      endDate: today,
      dateMode: 'day',
      customer: '',
      selectedCustomerId: null,
      customerSuggestions: [],
      customerTimer: null,
      orders: [],
      pagination: {
        page: 1,
        pageSize: 7,
        total: 0,
        totalPages: 1
      },
      summary: {
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0
      },
      loading: false,
      error: ''
    }
  },
  computed: {
    dateOptions() {
      return [
        { label: this.text.today, value: 'day' },
        { label: this.text.dateRange, value: 'range' },
        { label: this.text.allTime, value: 'all' }
      ]
    },
    dateIndex() {
      const index = this.dateOptions.findIndex(item => item.value === this.dateMode)
      return index < 0 ? 0 : index
    },
    dateLabel() {
      if (this.dateMode === 'all') return this.text.allTime
      if (this.dateMode === 'range') return this.text.dateRange
      return this.date
    },
    emptyText() {
      return this.dateMode === 'all' ? this.text.noOrder : this.text.noTodayOrder
    },
    pageOptions() {
      return Array.from({ length: this.pagination.totalPages }, (_, index) => ({
        label: `${this.text.pagePrefix} ${index + 1} ${this.text.pageSuffix}`,
        value: index + 1
      }))
    },
    pageIndex() {
      return Math.max(this.pagination.page - 1, 0)
    }
  },
  onShow() {
    if (!requireLogin()) return
    this.updatePageSize()
    this.loadOrders()
  },
  methods: {
    dateText,
    timeOnlyText,
    money,
    statusText,
    updatePageSize() {
      this.pagination.pageSize = 7
    },
    getCustomerClass(name) {
      if ((name || '').trim() === '\u5ba2\u6237') return 'customer-default'
      const colors = ['customer-a', 'customer-b', 'customer-c', 'customer-d', 'customer-e']
      const code = String(name || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
      return colors[code % colors.length]
    },
    changeDateMode(event) {
      const option = this.dateOptions[Number(event.detail.value)]
      this.dateMode = option.value
      this.pagination.page = 1
      this.loadOrders()
    },
    changeDate(event) {
      this.date = event.detail.value
      this.dateMode = 'day'
      this.pagination.page = 1
      this.loadOrders()
    },
    changeStartDate(event) {
      this.startDate = event.detail.value
      if (this.startDate > this.endDate) this.endDate = this.startDate
      this.dateMode = 'range'
      this.pagination.page = 1
      this.loadOrders()
    },
    changeEndDate(event) {
      this.endDate = event.detail.value
      if (this.endDate < this.startDate) this.startDate = this.endDate
      this.dateMode = 'range'
      this.pagination.page = 1
      this.loadOrders()
    },
    onCustomerInput() {
      this.selectedCustomerId = null
      this.pagination.page = 1
      clearTimeout(this.customerTimer)
      if (!this.customer.trim()) {
        this.customerSuggestions = []
        this.loadOrders()
        return
      }
      this.customerTimer = setTimeout(() => this.searchCustomers(), 250)
    },
    async searchCustomers() {
      const keyword = this.customer.trim()
      if (!keyword) {
        this.customerSuggestions = []
        return
      }
      this.customerSuggestions = await request({ url: `/api/customers/search?q=${encodeURIComponent(keyword)}` })
    },
    selectCustomer(customer) {
      this.customer = customer.name
      this.selectedCustomerId = customer.id
      this.pagination.page = 1
      this.customerSuggestions = []
      this.loadOrders()
    },
    async loadOrders() {
      const dateParam = this.dateMode === 'all' ? 'all' : (this.dateMode === 'range' ? 'range' : this.date)
      const rangeParams = this.dateMode === 'range' ? `&mode=range&startDate=${encodeURIComponent(this.startDate)}&endDate=${encodeURIComponent(this.endDate)}` : ''
      this.loading = true
      this.error = ''
      try {
        const result = await request({
          url: `/api/orders?date=${encodeURIComponent(dateParam)}${rangeParams}&customer=${encodeURIComponent(this.customer.trim())}&customerId=${this.selectedCustomerId || ''}&page=${this.pagination.page}&pageSize=${this.pagination.pageSize}`
        })
        const list = Array.isArray(result) ? result : (result.items || [])
        const visibleList = Array.isArray(list) ? list.filter(order => order.status !== 'cancelled') : []
        this.orders = visibleList.map(order => ({
          ...order,
          customerClassName: this.getCustomerClass(order.customerName)
        }))
        if (result && result.pagination) {
          this.pagination = {
            ...result.pagination,
            pageSize: result.pagination.pageSize || this.pagination.pageSize
          }
          this.summary = result.summary || {
            totalAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0
          }
        } else {
          this.pagination = {
            page: 1,
            pageSize: this.pagination.pageSize,
            total: this.orders.length,
            totalPages: 1
          }
          this.summary = {
            totalAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0
          }
        }
      } catch (err) {
        this.orders = []
        this.summary = {
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0
        }
        this.error = err.message || this.text.loadFailed
      } finally {
        this.loading = false
      }
    },
    changePage(page) {
      const nextPage = Math.min(Math.max(Number(page), 1), this.pagination.totalPages)
      if (nextPage === this.pagination.page) return
      this.pagination.page = nextPage
      this.loadOrders()
    },
    async reloadAfterChange() {
      await this.loadOrders()
      if (!this.orders.length && this.pagination.page > 1) {
        this.pagination.page -= 1
        await this.loadOrders()
      }
    },
    selectPage(event) {
      const option = this.pageOptions[Number(event.detail.value)]
      if (!option) return
      this.changePage(option.value)
    },
    openDebt() {
      uni.navigateTo({ url: `/pages/orders/debt?customerId=${this.selectedCustomerId}` })
    },
    openDetail(id) {
      uni.navigateTo({ url: `/pages/orders/detail?id=${id}` })
    },
    markPaid(id) {
      uni.showModal({
        title: this.text.confirmPaid,
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/orders/${id}/pay`, method: 'PATCH' })
          this.reloadAfterChange()
        }
      })
    },
    cancelOrder(id) {
      uni.showModal({
        title: this.text.confirmCancel,
        content: this.text.cancelTip,
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/orders/${id}/cancel`, method: 'PATCH' })
          this.reloadAfterChange()
        }
      })
    }
  }
}
</script>

<style>
.filter-row {
  position: relative;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12rpx;
  padding: 16rpx;
}

.date-wrap {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 88rpx;
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
  color: #718078;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.picker-input {
  display: flex;
  align-items: center;
}

.date-change {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  min-height: 72rpx;
  padding: 0 8rpx;
  border-radius: 10rpx;
  background: #e8f6ed;
  color: #16945f;
  font-size: 23rpx;
  font-weight: 900;
}

.search-wrap {
  position: relative;
  min-width: 0;
}

.suggest-float {
  position: absolute;
  left: 0;
  right: 0;
  top: 76rpx;
  z-index: 99;
  box-sizing: border-box;
  width: 100%;
  max-height: 168rpx;
  border: 2rpx solid #c9dcc9;
  border-radius: 12rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(24, 37, 46, 0.14);
  overflow: hidden;
}

.suggest-item {
  min-height: 56rpx;
  padding: 14rpx 18rpx;
  border-bottom: 1rpx solid #eef2ee;
  font-weight: 800;
}

.debt-entry {
  margin-bottom: 18rpx;
}

.debt-entry .soft-button {
  width: 100%;
}

.order-card {
  overflow: hidden;
}

.order-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-count {
  color: #6b7780;
  font-size: 24rpx;
  font-weight: 800;
}

.order-row {
  display: block;
  min-height: 82rpx;
  margin-bottom: 12rpx;
  padding: 14rpx;
  border: 2rpx solid #c9dcc9;
  border-radius: 16rpx;
  background: #fffef9;
  box-shadow: 0 6rpx 14rpx rgba(25, 55, 44, 0.04);
}

.order-main {
  display: grid;
  grid-template-columns: 112rpx minmax(0, 1fr) 142rpx;
  align-items: center;
  width: 100%;
  min-width: 0;
  column-gap: 8rpx;
}

.name,
.amount {
  font-weight: 900;
}

.name {
  display: inline-flex;
  align-items: center;
  max-width: 190rpx;
  height: 42rpx;
  margin-right: 10rpx;
  padding: 0 14rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
}

.amount {
  min-width: 0;
  text-align: center;
}

.order-time {
  min-width: 0;
  margin-right: 0;
  text-align: right;
  font-size: 24rpx;
}

.customer-default {
  background: #edf2eb;
  color: #748078;
}

.customer-a {
  background: #fff0c8;
  color: #9b6b00;
}

.customer-b {
  background: #ffe2dc;
  color: #c4493e;
}

.customer-c {
  background: #ebe6ff;
  color: #6b50c8;
}

.customer-d {
  background: #e0f0ff;
  color: #315f8f;
}

.customer-e {
  background: #e8f6ed;
  color: #166b4e;
}

.amount {
  color: #16945f;
}

.amount.unpaid {
  color: #d64b3f;
}

.amount.paid {
  color: #16945f;
}

.amount.cancelled {
  color: #9aa6a0;
}

.name,
.amount,
.muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  margin-top: 12rpx;
}

.paid-actions {
  display: flex;
  justify-content: center;
  margin-top: 14rpx;
}

.order-action-button {
  height: 58rpx;
  min-height: 58rpx;
  margin: 0;
  padding: 0;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 58rpx;
}

.order-action-button.success {
  background: #e8f6ed;
  color: #16945f;
}

.order-action-button.danger {
  background: #ffece8;
  color: #e85d4f;
}

.mini-button,
.status {
  min-width: 82rpx;
  height: 50rpx;
  min-height: 50rpx;
  margin-left: 8rpx;
  padding: 0 12rpx;
  border-radius: 10rpx;
  background: #e8f6ed;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1;
}

.paid,
.paid-text {
  color: #16945f;
}

.cancelled,
.status-text.cancelled {
  color: #e85d4f;
}

.paid-text,
.status-text {
  min-width: 180rpx;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.summary-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12rpx;
  margin: 10rpx -2rpx 12rpx;
  padding: 12rpx 10rpx;
  border-top: 2rpx solid #c9dcc9;
  border-bottom: 2rpx solid #c9dcc9;
  background: #fffef9;
}

.summary-item {
  display: grid;
  gap: 2rpx;
  min-width: 0;
  color: #4d565c;
  font-size: 23rpx;
  font-weight: 800;
}

.summary-item text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-item text:last-child {
  color: #16945f;
  font-size: 28rpx;
  font-weight: 900;
}

.summary-item.unpaid text:last-child {
  color: #d64b3f;
}

.summary-item.paid text:last-child {
  color: #16945f;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 8rpx;
}

.pager-button {
  width: 136rpx;
  height: 54rpx;
  min-height: 54rpx;
  margin: 0;
  padding: 0;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 54rpx;
}

.pager-button[disabled] {
  color: #9aa6a0;
  background: #edf2eb;
}

.pager-current {
  min-width: 190rpx;
  height: 54rpx;
  margin: 0 12rpx;
  padding: 0 14rpx;
  border: 2rpx solid #c9dcc9;
  border-radius: 12rpx;
  background: #fffef9;
  color: #415149;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 54rpx;
  text-align: center;
}

.empty {
  padding: 40rpx 0;
  color: #6b7780;
  text-align: center;
}

.error {
  color: #e85d4f;
}
</style>
