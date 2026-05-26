<template>
  <view class="page recycle-page">
    <view class="recycle-head">
      <view>
        <view class="head-label">订单回收站</view>
        <view class="head-title">已毁单记录</view>
      </view>
      <view class="head-count">{{ orders.length }}单</view>
    </view>

    <view class="soft-card tip-card">
      <view class="tip-title">回收站只放毁单订单</view>
      <view class="tip-text">可以查看订单内容，也可以将订单还原回正常未付状态。</view>
    </view>

    <view v-if="loading" class="soft-card empty">正在读取回收站...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <view v-else class="recycle-list">
      <view v-for="order in orders" :key="order.id" class="trash-card">
        <view class="trash-top">
          <view class="customer-block">
            <text class="customer-name" :class="order.customerClassName">{{ order.customerName }}</text>
            <text class="order-time">{{ timeText(order.createdAt) }}</text>
          </view>
          <view class="amount">¥{{ money(order.totalAmount) }}</view>
        </view>

        <view class="order-no">单号 {{ order.orderNo || order.id }}</view>
        <view class="item-preview">{{ itemPreview(order) }}</view>

        <view class="action-row">
          <button class="action-button view-button" @click="openDetail(order.id)">查看订单</button>
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
        <view class="empty-text">毁单后的订单会出现在这里。</view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { money, numberText, timeText } from '../../../utils/format'

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
    getCustomerClass(name) {
      if ((name || '').trim() === '客户') return 'customer-default'
      const colors = ['customer-a', 'customer-b', 'customer-c', 'customer-d', 'customer-e']
      const code = String(name || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
      return colors[code % colors.length]
    },
    async loadOrders() {
      this.loading = true
      this.error = ''
      try {
        const result = await request({ url: '/api/orders?date=all&status=cancelled&page=1&pageSize=200' })
        const list = Array.isArray(result) ? result : (result.items || [])
        this.orders = list
          .filter(order => order.status === 'cancelled')
          .map(order => ({
            ...order,
            customerClassName: this.getCustomerClass(order.customerName)
          }))
      } catch (err) {
        this.orders = []
        this.error = err.message || '回收站读取失败'
      } finally {
        this.loading = false
      }
    },
    itemPreview(order) {
      const items = Array.isArray(order.items) ? order.items : []
      if (!items.length) return '暂无商品明细'
      return items.slice(0, 2).map(item => {
        const count = numberText(item.quantity || 0)
        return `${item.goodsName} ${count}件`
      }).join('、')
    },
    openDetail(id) {
      uni.navigateTo({ url: `/pages/orders/detail?id=${id}` })
    },
    restoreOrder(id) {
      uni.showModal({
        title: '还原订单？',
        content: '还原后订单会回到未付状态，请确认库存是否需要同步处理。',
        confirmText: '还原',
        success: async (res) => {
          if (!res.confirm) return
          this.restoringId = id
          try {
            await request({ url: `/api/orders/${id}/restore`, method: 'PATCH' })
            uni.showToast({ title: '已还原到未付订单', icon: 'success' })
            await this.loadOrders()
          } catch (err) {
            const message = err.message || '还原失败，请确认后端已支持订单还原接口'
            uni.showToast({ title: message, icon: 'none' })
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

.head-count {
  min-width: 96rpx;
  height: 52rpx;
  border-radius: 18rpx;
  background: #fff6cf;
  color: #17362f;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 52rpx;
  text-align: center;
}

.tip-card {
  border-color: #c9dcc9;
  background: linear-gradient(135deg, #ffffff 0%, #f2fbf4 100%);
}

.tip-title {
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
}

.tip-text {
  margin-top: 6rpx;
  color: #718078;
  font-size: 24rpx;
}

.recycle-list {
  padding-bottom: 20rpx;
}

.trash-card {
  margin-bottom: 16rpx;
  padding: 18rpx;
  border: 2rpx solid #e4d7d4;
  border-radius: 18rpx;
  background: #fffef9;
  box-shadow: 0 10rpx 22rpx rgba(60, 45, 36, 0.07);
}

.trash-top {
  display: flex;
  gap: 12rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.customer-block {
  display: grid;
  gap: 8rpx;
  min-width: 0;
}

.customer-name {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 260rpx;
  min-height: 42rpx;
  padding: 0 14rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 26rpx;
  font-weight: 900;
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

.order-time {
  color: #718078;
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
  color: #718078;
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-preview {
  color: #415149;
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
  background: #e8f6ed;
  color: #166b4e;
}

.restore-button {
  background: #16945f;
  color: #ffffff;
}

.restore-button[disabled] {
  opacity: 0.68;
}

.empty,
.empty-state {
  color: #718078;
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
  background: #e8f6ed;
  color: #166b4e;
  font-size: 38rpx;
  font-weight: 900;
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

.recycle-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(36, 82, 119, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f6fbff 0%, #eef7ff 100%);
}

.head-label,
.empty-icon {
  color: #245277;
}

.head-title,
.empty-title,
.item-title {
  color: #17364e;
}

.soft-card,
.tip-card,
.trash-card,
.empty-state {
  border-color: #c9dcea;
  background: linear-gradient(145deg, #ffffff 0%, #f2f8ff 100%);
}

.empty-icon,
.view-button,
.restore-button[disabled] {
  background: #e4f0fa;
}

.restore-button {
  background: #245277;
  color: #ffffff;
}
</style>
