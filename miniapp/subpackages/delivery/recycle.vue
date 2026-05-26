<template>
  <view class="page delivery-recycle">
    <view class="recycle-head">
      <view>
        <view class="head-label">超市配送</view>
        <view class="head-title">订单回收站</view>
      </view>
      <view class="head-count">{{ orders.length }}单</view>
    </view>

    <view class="soft-card tip-card">
      <view class="tip-title">这里只放已作废的超市配送单</view>
      <view class="tip-text">可以查看送货单，也可以还原回正常订单状态。</view>
    </view>

    <view v-if="loading" class="soft-card empty">正在读取回收站...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <view v-else class="recycle-list">
      <view v-for="order in orders" :key="order.id" class="trash-card">
        <view class="trash-top">
          <view class="market-block">
            <text class="market-name">{{ order.supermarketName }}</text>
            <text class="order-time">{{ timeText(order.createdAt) }}</text>
          </view>
          <view class="amount">¥{{ money(order.totalAmount) }}</view>
        </view>

        <view class="order-no">单号 {{ order.orderNo || order.id }}</view>
        <view class="item-preview">利润 ¥{{ money(order.totalProfit) }} · {{ order.itemCount || 0 }} 项商品</view>

        <view class="action-row">
          <button class="action-button view-button" @click="openDetail(order.id)">查看送货单</button>
          <button
            class="action-button restore-button"
            :disabled="restoringId === order.id"
            @click="restoreOrder(order.id)"
          >
            {{ restoringId === order.id ? '还原中' : '还原订单' }}
          </button>
        </view>
      </view>

      <view v-if="!orders.length" class="soft-card empty-state">
        <view class="empty-icon">收</view>
        <view class="empty-title">回收站是空的</view>
        <view class="empty-text">作废后的超市配送单会出现在这里。</view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money, timeText } from '../../utils/format'

export default {
  data() {
    return {
      orders: [],
      loading: false,
      error: '',
      restoringId: ''
    }
  },
  onShow() {
    if (requireLogin()) this.loadOrders()
  },
  methods: {
    money,
    timeText,
    async loadOrders() {
      this.loading = true
      this.error = ''
      try {
        const result = await request({ url: '/api/supermarket-orders?date=all&status=cancelled&page=1&pageSize=200' })
        this.orders = Array.isArray(result) ? result : (result.items || [])
      } catch (err) {
        this.orders = []
        this.error = err.message || '超市订单回收站读取失败'
      } finally {
        this.loading = false
      }
    },
    openDetail(id) {
      uni.navigateTo({ url: `/subpackages/delivery/detail?id=${id}` })
    },
    restoreOrder(id) {
      uni.showModal({
        title: '还原超市订单？',
        content: '还原后会重新扣减自家商品库存，库存不足则无法还原。',
        confirmText: '还原',
        success: async (res) => {
          if (!res.confirm) return
          this.restoringId = id
          try {
            await request({ url: `/api/supermarket-orders/${id}/restore`, method: 'PATCH' })
            uni.showToast({ title: '已还原', icon: 'success' })
            await this.loadOrders()
          } catch (err) {
            uni.showToast({ title: err.message || '还原失败', icon: 'none' })
          } finally {
            this.restoringId = ''
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.recycle-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 18rpx 8rpx 14rpx;
}

.head-label {
  color: #4d6ed8;
  font-size: 24rpx;
  font-weight: 900;
}

.head-title {
  margin-top: 8rpx;
  color: #1f2f63;
  font-size: 42rpx;
  font-weight: 900;
}

.head-count {
  min-width: 96rpx;
  height: 52rpx;
  border-radius: 18rpx;
  background: #e9eefb;
  color: #4d6ed8;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 52rpx;
  text-align: center;
}

.tip-card {
  border-color: #cdd8fb;
  background: linear-gradient(135deg, #ffffff 0%, #f4f7ff 100%);
}

.tip-title {
  color: #1f2f63;
  font-size: 28rpx;
  font-weight: 900;
}

.tip-text {
  margin-top: 6rpx;
  color: #697597;
  font-size: 24rpx;
}

.trash-card {
  margin-bottom: 16rpx;
  padding: 18rpx;
  border: 2rpx solid #d9e1fb;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(52, 73, 140, 0.08);
}

.trash-top {
  display: flex;
  gap: 12rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.market-block {
  display: grid;
  gap: 8rpx;
  min-width: 0;
}

.market-name {
  overflow: hidden;
  color: #1f2f63;
  font-size: 30rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-time,
.order-no,
.item-preview {
  color: #697597;
  font-size: 24rpx;
}

.amount {
  color: #d64b3f;
  font-size: 34rpx;
  font-weight: 900;
}

.order-no,
.item-preview {
  overflow: hidden;
  margin-top: 12rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-preview {
  color: #4b5b82;
  font-weight: 800;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 16rpx;
}

.action-button {
  height: 62rpx;
  min-height: 62rpx;
  border-radius: 14rpx;
  font-size: 26rpx;
  font-weight: 900;
}

.view-button {
  background: #e9eefb;
  color: #4d6ed8;
}

.restore-button {
  background: #4d6ed8;
  color: #ffffff;
}

.restore-button[disabled] {
  opacity: 0.68;
}

.empty,
.empty-state {
  color: #697597;
  text-align: center;
}

.empty-state {
  padding: 48rpx 20rpx;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 90rpx;
  height: 90rpx;
  margin: 0 auto 16rpx;
  border-radius: 28rpx;
  background: #e9eefb;
  color: #4d6ed8;
  font-size: 38rpx;
  font-weight: 900;
}

.empty-title {
  color: #1f2f63;
  font-size: 30rpx;
  font-weight: 900;
}

.empty-text {
  margin-top: 8rpx;
  color: #697597;
  font-size: 24rpx;
}

.error {
  color: #d64b3f;
}
</style>
