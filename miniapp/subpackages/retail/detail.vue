<template>
  <view class="page retail-detail">
    <view v-if="loading" class="soft-card empty">正在读取详情...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>
    <view v-else-if="order">
      <view class="soft-card head-card">
        <view>
          <view class="order-title">{{ order.customerName }}</view>
          <view class="order-meta">{{ order.orderNo }} · {{ timeText(order.createdAt) }}</view>
        </view>
        <view class="status-tag" :class="order.status">{{ retailStatusText(order.status) }}</view>
      </view>

      <view class="soft-card summary-card">
        <view>
          <view class="summary-label">合计金额</view>
          <view class="summary-money">¥{{ money(order.totalAmount) }}</view>
        </view>
        <view class="summary-info">
          <view>电话：{{ order.customerPhone || '-' }}</view>
          <view>备注：{{ order.remark || '-' }}</view>
          <view v-if="profitMode">成本：¥{{ money(order.totalCost) }}</view>
          <view v-if="profitMode">利润：¥{{ money(order.totalProfit) }}</view>
        </view>
      </view>

      <view class="soft-card">
        <view class="section-title">商品明细</view>
        <view v-for="item in order.items" :key="item.id" class="item-row">
          <view>
            <view class="goods-name">{{ item.goodsName }}</view>
            <view class="item-meta">{{ itemText(item) }}</view>
            <view v-if="profitMode" class="item-profit">成本 ¥{{ money(item.costAmount) }} · 利润 ¥{{ money(item.profit) }}</view>
          </view>
          <view class="item-total">¥{{ money(item.subtotal) }}</view>
        </view>
      </view>

      <view class="action-row">
        <button v-if="order.status !== 'paid'" class="soft-button primary" @click="markPaid">标记已付</button>
        <button v-else class="soft-button unpay-button" @click="markUnpaid">改回未付</button>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money, numberText, timeText } from '../../utils/format'
import { retailStatusText } from './constants'

export default {
  data() {
    return {
      id: '',
      profitMode: false,
      order: null,
      loading: false,
      error: ''
    }
  },
  onLoad(query) {
    this.id = query.id
    this.profitMode = String(query.profit || '') === '1'
  },
  onShow() {
    if (requireLogin()) this.loadDetail()
  },
  methods: {
    money,
    timeText,
    retailStatusText,
    async loadDetail() {
      this.loading = true
      this.error = ''
      try {
        this.order = await request({ url: `/api/retail/orders/${this.id}` })
      } catch (err) {
        this.order = null
        this.error = err.message || '详情读取失败'
      } finally {
        this.loading = false
      }
    },
    itemText(item) {
      const base = item.unitType === 'weight' && item.weight
        ? `${numberText(item.quantity)}件 · ${numberText(item.weight)}斤 × ${money(item.price)}`
        : `${numberText(item.quantity)}件 × ${money(item.price)}`
      const commission = Number(item.commission || 0) > 0 ? ` + ${money(item.commission)}` : ''
      return `${item.categoryText} · ${base}${commission}`
    },
    async markPaid() {
      await request({ url: `/api/retail/orders/${this.id}/pay`, method: 'PATCH' })
      uni.showToast({ title: '已标记已付', icon: 'success' })
      this.loadDetail()
    },
    async markUnpaid() {
      await request({ url: `/api/retail/orders/${this.id}/unpay`, method: 'PATCH' })
      uni.showToast({ title: '已改回未付', icon: 'success' })
      this.loadDetail()
    }
  }
}
</script>

<style scoped>
.head-card,
.summary-card,
.item-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.order-title {
  color: #17362f;
  font-size: 34rpx;
  font-weight: 900;
}

.order-meta,
.summary-info,
.item-meta,
.item-profit {
  margin-top: 8rpx;
  color: #718078;
  font-size: 24rpx;
}

.item-profit {
  color: #16945f;
  font-weight: 900;
}

.status-tag {
  flex: 0 0 auto;
  height: 48rpx;
  padding: 0 16rpx;
  border-radius: 16rpx;
  background: #ffece8;
  color: #d64b3f;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 48rpx;
}

.status-tag.paid {
  background: #e8f6ed;
  color: #166b4e;
}

.summary-card {
  background: linear-gradient(135deg, #16a66c 0%, #0f7d55 100%);
  color: #ffffff;
}

.summary-label,
.summary-info {
  color: rgba(255, 255, 255, 0.86);
  font-weight: 800;
}

.summary-money {
  margin-top: 10rpx;
  color: #ffffff;
  font-size: 44rpx;
  font-weight: 900;
}

.item-row {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #eef2ee;
}

.goods-name {
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
}

.item-total {
  color: #d64b3f;
  font-size: 28rpx;
  font-weight: 900;
}

.action-row {
  padding: 10rpx 0 28rpx;
}

.action-row .soft-button {
  width: 100%;
}

.unpay-button {
  background: #fff6cf;
  color: #17362f;
}

.empty {
  color: #718078;
  text-align: center;
}

.error {
  color: #d64b3f;
}

.retail-detail {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(11, 154, 135, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f2fffb 0%, #e7fbf6 100%);
}

.soft-card,
.head-card,
.summary-card,
.detail-card {
  border-color: #bde5df;
  background: linear-gradient(145deg, #ffffff 0%, #effdfa 100%);
}

.section-title,
.strong,
.goods-name {
  color: #0d4d45;
}

.amount,
.profit,
.status.paid {
  color: #0b9a87;
}

.status.paid,
.save,
.unpay-button {
  background: #dff6f1;
  color: #0b9a87;
}

.pay {
  background: #0b9a87;
}
</style>
