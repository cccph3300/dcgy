<template>
  <view class="page print-detail-page">
    <view v-if="loading" class="soft-card empty">正在读取打印详情...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <template v-else-if="record">
      <view class="soft-card head-card">
        <view>
          <view class="head-label">{{ typeText(record.type) }}</view>
          <view class="head-title">{{ recordTitle(record) }}</view>
          <view class="muted">{{ timeText(record.createdAt) }}</view>
        </view>
        <view class="status-tag" :class="record.status">{{ statusText(record.status) }}</view>
      </view>

      <view class="soft-card info-card">
        <view class="info-row"><text>店员</text><text>{{ record.staffName || '-' }}</text></view>
        <view class="info-row"><text>打印机</text><text>{{ record.printerSn || '-' }}</text></view>
        <view class="info-row"><text>单号</text><text>{{ record.orderNo || '-' }}</text></view>
        <view class="info-row"><text>客户</text><text>{{ record.customerName || '-' }}</text></view>
        <view v-if="record.errorMessage" class="error-text">{{ record.errorMessage }}</view>
      </view>

      <view class="soft-card content-card">
        <view class="section-title">打印内容</view>
        <text class="print-content">{{ displayContent }}</text>
      </view>

      <view class="action-bar">
        <button class="soft-button primary" :disabled="reprinting" @click="reprint">{{ reprinting ? '重打中' : '重新打印' }}</button>
        <button class="soft-button danger-button" :disabled="deleting" @click="deleteRecord">{{ deleting ? '删除中' : '删除记录' }}</button>
      </view>
    </template>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { timeText } from '../../../utils/format'

export default {
  data() {
    return {
      id: '',
      record: null,
      loading: true,
      error: '',
      reprinting: false,
      deleting: false
    }
  },
  computed: {
    displayContent() {
      return String(this.record?.content || '')
        .replace(/<BR>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
    }
  },
  onLoad(query) {
    this.id = query.id || ''
  },
  onShow() {
    if (requireLogin()) this.loadDetail()
  },
  methods: {
    timeText,
    typeText(type) {
      return type === 'customer_debt' ? '客户欠账单' : '订单小票'
    },
    statusText(status) {
      return status === 'success' ? '成功' : '失败'
    },
    recordTitle(record) {
      if (record.customerName) return record.customerName
      if (record.orderNo) return `单号 ${record.orderNo}`
      return `记录 #${record.id}`
    },
    async loadDetail() {
      this.loading = true
      this.error = ''
      try {
        this.record = await request({ url: `/api/prints/records/${this.id}` })
      } catch (err) {
        this.record = null
        this.error = err.message || '打印详情读取失败'
      } finally {
        this.loading = false
      }
    },
    reprint() {
      uni.showModal({
        title: '重新打印？',
        content: '会按当前记录中的原始打印内容重新发送到打印机。',
        confirmText: '重打',
        success: async (res) => {
          if (!res.confirm || this.reprinting) return
          this.reprinting = true
          try {
            await request({ url: `/api/prints/records/${this.id}/reprint`, method: 'POST' })
            uni.showToast({ title: '已发送打印', icon: 'success' })
          } finally {
            this.reprinting = false
          }
        }
      })
    },
    deleteRecord() {
      uni.showModal({
        title: '删除打印记录？',
        content: '删除后只移除记录，不会影响原订单。',
        confirmText: '删除',
        success: async (res) => {
          if (!res.confirm || this.deleting) return
          this.deleting = true
          try {
            await request({ url: `/api/prints/records/${this.id}`, method: 'DELETE' })
            uni.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => uni.navigateBack({ delta: 1 }), 300)
          } finally {
            this.deleting = false
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.print-detail-page {
  padding-bottom: calc(118rpx + var(--window-bottom, 0px) + env(safe-area-inset-bottom));
}

.head-card {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.head-label {
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
}

.head-title {
  margin-top: 8rpx;
  color: #17362f;
  font-size: 38rpx;
  font-weight: 900;
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

.info-card {
  display: grid;
  gap: 12rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  color: #17362f;
  font-size: 26rpx;
}

.info-row text:first-child {
  color: #718078;
  font-weight: 900;
}

.error-text {
  color: #d64b3f;
  font-size: 24rpx;
}

.content-card {
  padding: 18rpx;
}

.print-content {
  display: block;
  padding: 16rpx;
  border-radius: 14rpx;
  background: #f8fbf4;
  color: #17362f;
  font-family: monospace;
  font-size: 24rpx;
  line-height: 1.55;
  white-space: pre-wrap;
}

.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--window-bottom, 0px);
  z-index: 80;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  padding: 12rpx 18rpx calc(12rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #cfe6d5;
  background: #ffffff;
}

.danger-button {
  background: #ffece8;
  color: #d64b3f;
}

.empty {
  color: #718078;
  text-align: center;
}

.error {
  color: #d64b3f;
}

.print-detail-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(36, 82, 119, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f6fbff 0%, #eef7ff 100%);
}

.soft-card,
.detail-card,
.content-card {
  border-color: #c9dcea;
  background: linear-gradient(145deg, #ffffff 0%, #f2f8ff 100%);
}

.section-title,
.detail-title,
.content-text {
  color: #17364e;
}

.action-bar {
  border-top-color: #c9dcea;
  background: #f6fbff;
}

.soft-button:not(.danger-button) {
  background: #e4f0fa;
  color: #245277;
}
</style>
