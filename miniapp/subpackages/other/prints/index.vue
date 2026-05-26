<template>
  <view class="page print-page">
    <view class="print-head">
      <view>
        <view class="head-label">东成果业</view>
        <view class="head-title">打印记录</view>
      </view>
      <button class="refresh-button" :disabled="loading" @click="loadRecords">{{ loading ? '读取中' : '刷新' }}</button>
    </view>

    <view class="soft-card filter-card">
      <picker :value="modeIndex" :range="modeOptions" range-key="label" @change="changeMode">
        <view class="input picker-input">{{ modeLabel }}</view>
      </picker>
      <picker v-if="mode === 'day'" mode="date" :value="day" @change="changeDay">
        <view class="date-button">选择日期：{{ day }}</view>
      </picker>
      <view v-if="mode === 'range'" class="range-row">
        <picker mode="date" :value="startDate" @change="changeStartDate">
          <view class="date-button">{{ startDate }}</view>
        </picker>
        <text class="range-sep">至</text>
        <picker mode="date" :value="endDate" @change="changeEndDate">
          <view class="date-button">{{ endDate }}</view>
        </picker>
      </view>
    </view>

    <view v-if="loading" class="soft-card empty">正在读取打印记录...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <view v-else class="record-list">
      <view v-for="item in records" :key="item.id" class="record-card" @click="openDetail(item.id)">
        <view class="record-top">
          <view>
            <view class="record-title">{{ recordTitle(item) }}</view>
            <view class="record-meta">{{ typeText(item.type) }} · {{ timeText(item.createdAt) }}</view>
          </view>
          <view class="status-tag" :class="item.status">{{ statusText(item.status) }}</view>
        </view>
        <view class="record-line">店员：{{ item.staffName || '-' }}</view>
        <view class="record-line">打印机：{{ item.printerSn || '-' }}</view>
        <view v-if="item.errorMessage" class="record-error">{{ item.errorMessage }}</view>
      </view>

      <view v-if="!records.length" class="soft-card empty-state">
        <view class="empty-title">暂无打印记录</view>
        <view class="empty-text">打印订单或客户欠账单后会出现在这里。</view>
      </view>

      <view class="pager">
        <button class="pager-button" :disabled="page <= 1 || loading" @click="changePage(page - 1)">上一页</button>
        <text>{{ page }} / {{ totalPages }}</text>
        <button class="pager-button" :disabled="page >= totalPages || loading" @click="changePage(page + 1)">下一页</button>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { timeText, todayText } from '../../../utils/format'

const today = todayText()

export default {
  data() {
    return {
      mode: 'day',
      day: today,
      startDate: today,
      endDate: today,
      modeOptions: [
        { label: '今天', value: 'day' },
        { label: '当月', value: 'month' },
        { label: '全部时间', value: 'all' },
        { label: '选择时间', value: 'range' }
      ],
      records: [],
      page: 1,
      pageSize: 10,
      totalPages: 1,
      loading: false,
      error: ''
    }
  },
  computed: {
    modeIndex() {
      const index = this.modeOptions.findIndex(item => item.value === this.mode)
      return index < 0 ? 0 : index
    },
    modeLabel() {
      return this.modeOptions[this.modeIndex].label
    }
  },
  onShow() {
    if (requireLogin()) this.loadRecords()
  },
  methods: {
    timeText,
    typeText(type) {
      return type === 'customer_debt' ? '客户欠账单' : '订单小票'
    },
    statusText(status) {
      return status === 'success' ? '成功' : '失败'
    },
    recordTitle(item) {
      if (item.customerName) return item.customerName
      if (item.orderNo) return `单号 ${item.orderNo}`
      return `记录 #${item.id}`
    },
    changeMode(event) {
      const option = this.modeOptions[Number(event.detail.value)]
      this.mode = option.value
      this.page = 1
      this.loadRecords()
    },
    changeDay(event) {
      this.day = event.detail.value
      this.page = 1
      this.loadRecords()
    },
    changeStartDate(event) {
      this.startDate = event.detail.value
      if (this.startDate > this.endDate) this.endDate = this.startDate
      this.page = 1
      this.loadRecords()
    },
    changeEndDate(event) {
      this.endDate = event.detail.value
      if (this.endDate < this.startDate) this.startDate = this.endDate
      this.page = 1
      this.loadRecords()
    },
    changePage(page) {
      this.page = page
      this.loadRecords()
    },
    openDetail(id) {
      uni.navigateTo({ url: `/subpackages/other/prints/detail?id=${id}` })
    },
    async loadRecords() {
      this.loading = true
      this.error = ''
      try {
        const result = await request({
          url: `/api/prints/records?mode=${encodeURIComponent(this.mode)}&day=${encodeURIComponent(this.day)}&startDate=${encodeURIComponent(this.startDate)}&endDate=${encodeURIComponent(this.endDate)}&page=${this.page}&pageSize=${this.pageSize}`
        })
        this.records = result.items || []
        this.totalPages = result.totalPages || 1
      } catch (err) {
        this.records = []
        this.totalPages = 1
        this.error = err.message || '打印记录读取失败'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.print-head {
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

.filter-card {
  display: grid;
  gap: 12rpx;
  padding: 16rpx;
}

.picker-input,
.date-button {
  display: flex;
  align-items: center;
  min-height: 64rpx;
}

.date-button {
  padding: 0 18rpx;
  border: 1rpx solid #dce8da;
  border-radius: 12rpx;
  background: #f8fbf4;
  color: #17362f;
  font-weight: 900;
}

.range-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42rpx minmax(0, 1fr);
  gap: 10rpx;
  align-items: center;
}

.range-sep {
  color: #718078;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.record-card {
  margin-bottom: 16rpx;
  padding: 18rpx;
  border: 2rpx solid #d7ead9;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(25, 55, 44, 0.07);
}

.record-card:active {
  background: #f2fbf4;
}

.record-top {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
}

.record-title {
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
}

.record-meta,
.record-line {
  margin-top: 8rpx;
  color: #718078;
  font-size: 24rpx;
}

.status-tag {
  flex: 0 0 auto;
  height: 44rpx;
  padding: 0 16rpx;
  border-radius: 14rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 44rpx;
}

.status-tag.failed {
  background: #ffece8;
  color: #d64b3f;
}

.record-error {
  margin-top: 10rpx;
  color: #d64b3f;
  font-size: 23rpx;
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

.empty,
.empty-state {
  color: #718078;
  text-align: center;
}

.empty-state {
  padding: 48rpx 20rpx;
}

.empty-title {
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
}

.empty-text {
  margin-top: 8rpx;
  color: #718078;
  font-size: 24rpx;
}

.error {
  color: #d64b3f;
}

.print-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(36, 82, 119, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f6fbff 0%, #eef7ff 100%);
}

.soft-card,
.filter-card,
.record-card,
.empty-state {
  border-color: #c9dcea;
  background: linear-gradient(145deg, #ffffff 0%, #f2f8ff 100%);
}

.section-title,
.record-title,
.empty-title,
.pager {
  color: #17364e;
}

.record-type,
.pager-button {
  color: #245277;
}

.pager-button,
.mini-button:not(.danger) {
  background: #e4f0fa;
}
</style>
