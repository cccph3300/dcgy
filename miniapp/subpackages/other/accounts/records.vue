<template>
  <view class="page account-records">
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
      <input v-model="supplierName" class="input search-input" placeholder="货主名称" confirm-type="search" @confirm="reload" />
    </view>

    <view class="soft-card list-card">
      <view class="title-row">
        <view class="section-title">入账记录</view>
        <view class="count">共{{ pagination.total }}单</view>
      </view>

      <view v-if="loading" class="empty">正在读取入账记录...</view>
      <view v-else-if="error" class="empty error">{{ error }}</view>
      <view v-else>
        <view v-for="entry in entries" :key="entry.id" class="entry-row" @click="openDetail(entry.id)">
          <view class="entry-main">
            <view class="entry-top">
              <text class="supplier">{{ entry.supplierName }}</text>
              <text class="amount" :class="entry.status">¥{{ money(entry.totalAmount) }}</text>
            </view>
            <text class="goods">{{ entry.goodsName }} · {{ itemSummary(entry) }}</text>
            <view class="entry-foot">
              <text class="muted">{{ timeText(entry.createdAt) }}</text>
              <view class="entry-actions">
                <button v-if="entry.status === 'unpaid'" class="pay-button" @click.stop="payEntry(entry)">付清</button>
                <text class="status" :class="entry.status">{{ statusText(entry.status) }}</text>
              </view>
            </view>
          </view>
        </view>
        <view v-if="!entries.length" class="empty">没有入账记录</view>

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
import { request, requireLogin } from '../../../utils/request'
import { money, numberText, timeText, todayText } from '../../../utils/format'

export default {
  data() {
    const today = todayText()
    return {
      date: today,
      startDate: today,
      endDate: today,
      dateMode: 'day',
      status: '',
      supplierName: '',
      entries: [],
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
        { label: '未付', value: 'unpaid' },
        { label: '已付清', value: 'paid' }
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
    if (requireLogin()) this.loadEntries()
  },
  methods: {
    money,
    numberText,
    timeText,
    statusText(status) {
      return status === 'paid' ? '已付清' : '未付'
    },
    itemSummary(entry) {
      const quantity = `${numberText(entry.quantity)}件`
      if (entry.unitType === 'weight' && entry.weight) {
        return `${quantity} · ${numberText(entry.weight)}斤 · 成本${money(entry.costPrice)}/斤`
      }
      return `${quantity} · 成本${money(entry.costPrice)}/件`
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
      this.loadEntries()
    },
    changePage(page) {
      const next = Math.min(Math.max(Number(page), 1), this.pagination.totalPages)
      if (next === this.pagination.page) return
      this.pagination.page = next
      this.loadEntries()
    },
    selectPage(event) {
      const option = this.pageOptions[Number(event.detail.value)]
      if (option) this.changePage(option.value)
    },
    async loadEntries() {
      this.loading = true
      this.error = ''
      try {
        const dateParam = this.dateMode === 'all' ? 'all' : (this.dateMode === 'range' ? 'range' : this.date)
        const rangeParams = this.dateMode === 'range'
          ? `&mode=range&startDate=${encodeURIComponent(this.startDate)}&endDate=${encodeURIComponent(this.endDate)}`
          : ''
        const result = await request({
          url: `/api/supplier-entries?date=${encodeURIComponent(dateParam)}${rangeParams}&supplierName=${encodeURIComponent(this.supplierName.trim())}&status=${encodeURIComponent(this.status)}&page=${this.pagination.page}&pageSize=${this.pagination.pageSize}`
        })
        this.entries = result.items || []
        this.pagination = result.pagination || {
          page: 1,
          pageSize: this.pagination.pageSize,
          total: this.entries.length,
          totalPages: 1
        }
      } catch (err) {
        this.entries = []
        this.error = err.message || '入账记录读取失败'
      } finally {
        this.loading = false
      }
    },
    openDetail(id) {
      uni.navigateTo({ url: `/subpackages/other/accounts/detail?id=${id}` })
    },
    payEntry(entry) {
      uni.showModal({
        title: '确认付清',
        content: `货主：${entry.supplierName}\n品名：${entry.goodsName}\n总金额：¥${money(entry.totalAmount)}`,
        confirmText: '付清',
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/supplier-entries/${entry.id}/pay`, method: 'PATCH' })
          uni.showToast({ title: '已付清', icon: 'success' })
          this.loadEntries()
        }
      })
    }
  }
}
</script>

<style scoped>
.filter-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12rpx;
  padding: 16rpx;
}

.date-wrap {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 108rpx;
  gap: 8rpx;
  align-items: center;
}

.range-wrap {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38rpx minmax(0, 1fr);
  gap: 8rpx;
  align-items: center;
}

.filter-card .search-input {
  grid-column: 1 / -1;
}

.picker-input,
.filter-button,
.date-change {
  display: flex;
  align-items: center;
}

.filter-button,
.date-change {
  justify-content: center;
  min-height: 68rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
}

.range-sep {
  color: #718078;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.list-card {
  padding: 18rpx;
}

.title-row,
.entry-top,
.entry-foot,
.entry-actions,
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.count {
  color: #718078;
  font-size: 24rpx;
  font-weight: 900;
}

.entry-row {
  margin-bottom: 12rpx;
  padding: 16rpx;
  border: 2rpx solid #c9dcc9;
  border-radius: 16rpx;
  background: #fffef9;
}

.entry-main {
  min-width: 0;
}

.supplier {
  max-width: 330rpx;
  overflow: hidden;
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  color: #d64b3f;
  font-size: 30rpx;
  font-weight: 900;
}

.amount.paid {
  color: #16945f;
}

.goods {
  display: block;
  overflow: hidden;
  margin-top: 8rpx;
  color: #415149;
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-foot {
  margin-top: 12rpx;
}

.entry-actions {
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

.status {
  min-width: 92rpx;
  height: 44rpx;
  border-radius: 12rpx;
  background: #fff6cf;
  color: #9b6b00;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 44rpx;
  text-align: center;
}

.status.paid {
  background: #e8f6ed;
  color: #16945f;
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
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
}

.pager-current {
  min-width: 190rpx;
  height: 54rpx;
  margin: 0 12rpx;
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
  padding: 42rpx 0;
  color: #718078;
  text-align: center;
}

.error {
  color: #d64b3f;
}

.account-records {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(217, 120, 23, 0.14), transparent 190rpx),
    linear-gradient(180deg, #fffaf0 0%, #fff3dc 100%);
}

.filter-card,
.list-card,
.entry-row {
  border-color: #efd7aa;
  background: linear-gradient(145deg, #ffffff 0%, #fff8e8 100%);
}

.section-title,
.supplier {
  color: #6f3d05;
}

.amount.paid,
.profit,
.status.paid,
.pager-button {
  color: #d97817;
}

.filter-button,
.date-change,
.status.paid,
.pager-button {
  background: #fff1d1;
}

.pay-button {
  background: #d97817;
}

.pager-current {
  border-color: #efd7aa;
  background: #ffffff;
}
</style>
