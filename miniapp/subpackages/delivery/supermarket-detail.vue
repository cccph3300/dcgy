<template>
  <view class="page supermarket-detail-page">
    <view v-if="loading" class="soft-card empty">正在读取超市订单...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <view v-else>
      <view class="market-line">
        <text class="market-name">{{ detail.supermarket.name }}</text>
        <text class="market-note">超市订单</text>
      </view>

      <view class="soft-card summary-card">
        <view class="summary-main">
          <view class="summary-title">未结金额</view>
          <view class="summary-row">
            <text class="summary-label">总欠账：</text>
            <text class="summary-value">¥{{ money(detail.totalAmount) }}/{{ detail.orderCount }}单</text>
          </view>
          <view class="summary-row unpaid-row">
            <text class="summary-label">未结：</text>
            <text class="summary-unpaid">¥{{ money(detail.totalAmount) }}</text>
          </view>
        </view>
      </view>

      <view class="tabs">
        <view class="tab" :class="{ active: activeTab === 'debt' }" @click="activeTab = 'debt'">未结订单</view>
        <view class="tab" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">
          全部账单
          <text v-if="detail.allOrderCount" class="dot"></text>
        </view>
      </view>

      <view class="content">
        <view v-if="activeTab === 'all'" class="range-note">只显示最近一年的账单</view>
        <view v-if="!visibleOrders.length" class="empty-state">暂无订单</view>

        <view
          v-for="order in visibleOrders"
          :key="order.id"
          class="order-card"
          @click="openOrder(order.id)"
        >
          <view class="order-head">
            <view>
              <view class="order-date">{{ dateText(order.createdAt) }}</view>
              <view class="order-no">单号 {{ order.orderNo }}</view>
            </view>
            <view class="order-state">
              <view class="order-amount" :class="order.status">¥{{ money(order.totalAmount) }}</view>
              <view class="order-status" :class="order.status">{{ statusText(order.status) }}</view>
            </view>
          </view>
          <view class="order-meta">
            <text>{{ order.itemCount }}个商品</text>
            <text>佣金 ¥{{ money(order.totalCommission) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { dateText, money, statusText as baseStatusText } from '../../utils/format'

export default {
  data() {
    return {
      name: '',
      detail: null,
      activeTab: 'debt',
      loading: true,
      error: ''
    }
  },
  computed: {
    visibleOrders() {
      if (!this.detail) return []
      return this.activeTab === 'all' ? (this.detail.allOrders || []) : (this.detail.orders || [])
    }
  },
  onLoad(query) {
    this.name = decodeURIComponent(query.name || '')
  },
  onShow() {
    if (requireLogin()) this.loadDetail()
  },
  methods: {
    dateText,
    money,
    statusText(status) {
      if (status === 'active') return '未结'
      return baseStatusText(status)
    },
    async loadDetail() {
      this.loading = true
      this.error = ''
      try {
        this.detail = await request({ url: `/api/supermarkets/detail?name=${encodeURIComponent(this.name)}` })
      } catch (err) {
        this.error = err.message || '超市订单读取失败'
      } finally {
        this.loading = false
      }
    },
    openOrder(id) {
      uni.navigateTo({ url: `/subpackages/delivery/detail?id=${id}` })
    }
  }
}
</script>

<style scoped>
.supermarket-detail-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(77, 110, 216, 0.16), transparent 180rpx),
    radial-gradient(circle at 92% 10%, rgba(111, 88, 201, 0.12), transparent 220rpx),
    linear-gradient(180deg, #f6f8ff 0%, #eef3ff 100%);
}

.market-line {
  display: flex;
  align-items: center;
  min-height: 84rpx;
  padding: 0 8rpx 14rpx;
}

.market-name {
  display: inline-flex;
  align-items: center;
  min-height: 44rpx;
  max-width: 430rpx;
  overflow: hidden;
  padding: 0 14rpx;
  border-radius: 12rpx;
  background: #e9eefb;
  color: #4d6ed8;
  font-size: 30rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-note {
  margin-left: 16rpx;
  color: #697597;
  font-size: 26rpx;
}

.summary-card {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 20rpx;
  min-height: 230rpx;
  padding: 28rpx;
  border-color: #cdd8fb;
  background: linear-gradient(135deg, #ffffff 0%, #f4f7ff 100%);
  color: #1f2f63;
  box-shadow: 0 12rpx 28rpx rgba(52, 73, 140, 0.12);
}

.summary-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 14rpx;
}

.summary-title {
  margin-bottom: 4rpx;
  color: #4d6ed8;
  font-size: 28rpx;
  font-weight: 900;
}

.summary-row {
  display: flex;
  align-items: baseline;
  min-width: 0;
}

.summary-label {
  flex-shrink: 0;
  color: #4b5b82;
  font-size: 27rpx;
  font-weight: 800;
}

.summary-value {
  overflow: hidden;
  color: #1f2f63;
  font-size: 31rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-unpaid {
  overflow: hidden;
  color: #4d6ed8;
  font-size: 54rpx;
  font-weight: 900;
  line-height: 1.08;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabs {
  display: flex;
  margin: 0 0 16rpx;
  border-radius: 10rpx;
  background: #e9eefb;
  overflow: hidden;
}

.tab {
  position: relative;
  flex: 1;
  height: 74rpx;
  color: #4b5b82;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 74rpx;
  text-align: center;
}

.tab.active {
  border-radius: 10rpx;
  background: #ffffff;
  box-shadow: 0 4rpx 10rpx rgba(52, 73, 140, 0.14);
  color: #4d6ed8;
  font-weight: 900;
}

.dot {
  position: absolute;
  top: 16rpx;
  width: 18rpx;
  height: 18rpx;
  margin-left: 8rpx;
  border-radius: 50%;
  background: #ff3b30;
}

.content {
  min-height: 650rpx;
}

.order-card {
  margin-bottom: 16rpx;
  padding: 18rpx;
  border: 1rpx solid #cdd8fb;
  border-radius: 16rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f4f7ff 100%);
  box-shadow: 0 8rpx 18rpx rgba(52, 73, 140, 0.08);
}

.order-card:active {
  background: #eef3ff;
}

.order-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 14rpx;
  border-bottom: 1rpx solid #e7ecfa;
}

.order-date {
  font-size: 28rpx;
  font-weight: 900;
}

.order-no {
  margin-top: 4rpx;
  color: #7b86a6;
  font-size: 22rpx;
}

.order-state {
  text-align: right;
}

.order-amount {
  color: #4d6ed8;
  font-size: 30rpx;
  font-weight: 900;
}

.order-amount.active {
  color: #4d6ed8;
}

.order-amount.cancelled {
  color: #9aa6a0;
}

.order-status {
  margin-top: 4rpx;
  color: #697597;
  font-size: 22rpx;
  font-weight: 800;
}

.order-status.paid {
  color: #4d6ed8;
}

.order-status.cancelled {
  color: #e85d4f;
}

.order-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx 22rpx;
  padding-top: 14rpx;
  color: #697597;
  font-size: 23rpx;
  font-weight: 800;
}

.loss {
  color: #d64b3f;
}

.range-note {
  margin-bottom: 14rpx;
  color: #697597;
  font-size: 24rpx;
  text-align: center;
}

.empty,
.empty-state {
  color: #697597;
  text-align: center;
}

.empty-state {
  padding: 160rpx 20rpx;
}

.error {
  color: #d64b3f;
}
</style>
