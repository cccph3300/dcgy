<template>
  <view class="debt-page">
    <view v-if="loading" class="loading">{{ text.loading }}</view>
    <view v-else-if="error" class="error">{{ error }}</view>

    <view v-else>
      <view class="shop-head">
        <view class="shop-name">{{ text.shopName }}</view>
      </view>

      <view class="customer-line">
        <text class="customer-name" :class="debt.customer.className">{{ debt.customer.name }}</text>
        <text class="customer-note">{{ text.customerBill }}</text>
      </view>

      <view class="summary-card">
        <view>
          <view class="summary-label">{{ text.debtAmount }}</view>
          <view class="summary-money">¥{{ amountText(debt, 'totalAmount', 'total') }}<text>/{{ debt.orderCount }}{{ text.orderUnit }}</text></view>
        </view>
        <view class="summary-actions">
          <!-- #ifdef MP-WEIXIN -->
          <button v-if="!isSharedView" class="summary-action" :disabled="!shareToken || preparingShare" open-type="share">
            {{ preparingShare ? text.sharePreparing : text.shareBill }}
          </button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <button v-if="!isSharedView" class="summary-action" @click="ignoreWebShare">{{ text.shareBill }}</button>
          <!-- #endif -->
          <button v-if="!isSharedView" class="summary-action print-action" :disabled="printing" @click="printDebtBill">{{ printing ? text.printing : text.printBill }}</button>
        </view>
      </view>

      <view v-if="!isSharedView" class="tabs">
        <view class="tab" :class="{ active: activeTab === 'debt' }" @click="activeTab = 'debt'">{{ text.debtOrders }}</view>
        <view class="tab" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">
          {{ text.allBills }}
          <text v-if="debt.allOrderCount" class="dot"></text>
        </view>
      </view>

      <view class="content">
        <view v-if="!visibleOrders.length" class="empty-state">
          <view class="empty-paper">
            <view class="paper-clip"></view>
            <view class="paper-line wide"></view>
            <view class="paper-line"></view>
            <view class="paper-line short"></view>
          </view>
          <view class="empty-text">{{ text.empty }}</view>
        </view>

        <view v-if="activeTab === 'all'" class="range-note">{{ text.oneYearTip }}</view>

        <view v-for="order in visibleOrders" :key="order.id" class="order-card">
          <view class="order-head">
            <view>
              <view class="order-date">{{ dateText(order.createdAt) }}</view>
              <view class="order-no">{{ text.orderNo }} {{ order.orderNo }}</view>
            </view>
            <view class="order-side">
              <view class="order-amount" :class="order.status">¥{{ amountText(order, 'totalAmount', 'amount') }}</view>
              <view class="order-status" :class="order.status">{{ statusText(order.status) }}</view>
            </view>
          </view>

          <view v-for="item in order.items" :key="item.id" class="item-row">
            <view class="item-main">
              <text class="goods-name">{{ item.goodsName }}</text>
              <text class="item-meta">{{ itemSummary(item) }} · {{ text.unitPrice }}{{ amountText(item, 'price') }}</text>
            </view>
            <text class="item-total" :class="order.status">¥{{ amountText(item, 'subtotal', 'totalAmount') }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { dateText, money, numberText, statusText } from '../../utils/format'

const zh = {
  loading: '\u6b63\u5728\u8bfb\u53d6\u6b20\u8d26...',
  shopName: '\u4e1c\u6210\u679c\u4e1a',
  customerBill: '\u5ba2\u6237\u6b20\u8d26\u5355',
  debtAmount: '\u8d4a\u6b20\u91d1\u989d',
  orderUnit: '\u5355',
  reconcile: '\u8d4a\u8fd8\u5bf9\u8d26 >',
  shareBill: '\u5206\u4eab\u8d26\u5355 >',
  sharePreparing: '\u51c6\u5907\u5206\u4eab...',
  printBill: '\u6253\u5370\u8d26\u5355',
  printing: '\u6253\u5370\u4e2d',
  printSuccess: '\u5df2\u53d1\u9001\u6253\u5370',
  debtOrders: '\u8d4a\u6b20\u8ba2\u5355',
  allBills: '\u5168\u90e8\u8d26\u5355',
  empty: '\u6682\u65e0\u6570\u636e',
  oneYearTip: '\u53ea\u663e\u793a\u6700\u8fd1\u4e00\u5e74\u7684\u8d26\u5355',
  orderNo: '\u5355\u53f7',
  unitPrice: '\u5355\u4ef7',
  shareTitle: '\u7684\u6b20\u8d26\u5355',
  loadFailed: '\u6b20\u8d26\u8bfb\u53d6\u5931\u8d25'
}

export default {
  data() {
    return {
      text: zh,
      customerId: '',
      shareToken: '',
      isSharedView: false,
      debt: null,
      activeTab: 'debt',
      printing: false,
      loading: true,
      error: '',
      preparingShare: false
    }
  },
  computed: {
    visibleOrders() {
      if (!this.debt) return []
      return this.activeTab === 'all' ? (this.debt.allOrders || []) : this.debt.orders
    }
  },
  onLoad(query) {
    this.customerId = query.customerId
    this.shareToken = query.token || ''
    this.isSharedView = query.share === '1'
    if (this.isSharedView) this.activeTab = 'debt'
  },
  onShow() {
    if (this.isSharedView || requireLogin()) this.loadDebt()
  },
  onShareAppMessage() {
    const customerName = this.debt?.customer?.name || ''
    return {
      title: `${customerName}${this.text.shareTitle}`,
      path: `/pages/orders/debt?customerId=${this.customerId}&share=1&token=${encodeURIComponent(this.shareToken)}`
    }
  },
  methods: {
    dateText,
    money,
    statusText,
    amountText(source, ...keys) {
      const target = source || {}
      for (const key of keys) {
        if (target[key] !== undefined && target[key] !== null && target[key] !== '') {
          return money(target[key])
        }
      }
      return money(0)
    },
    getCustomerClass(name) {
      if ((name || '').trim() === '客户') return 'customer-default'
      const colors = ['customer-a', 'customer-b', 'customer-c', 'customer-d', 'customer-e']
      const code = String(name || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
      return colors[code % colors.length]
    },
    async ensureShareToken() {
      if (this.shareToken) return this.shareToken
      if (!this.customerId || this.preparingShare || this.isSharedView) return ''
      this.preparingShare = true
      try {
        const result = await request({ url: `/api/customers/${this.customerId}/debt-share` })
        this.shareToken = result.token
        return this.shareToken
      } finally {
        this.preparingShare = false
      }
    },
    ignoreWebShare() {
      // H5 端没有微信好友分享能力，保持按钮无操作，避免误导为复制或系统分享。
    },
    async loadDebt() {
      this.loading = true
      this.error = ''
      try {
        const url = this.isSharedView
          ? `/api/share/debts/${this.customerId}?token=${encodeURIComponent(this.shareToken)}`
          : `/api/customers/${this.customerId}/debts`
        const debt = await request({ url, auth: !this.isSharedView })
        this.debt = {
          ...debt,
          customer: {
            ...debt.customer,
            className: this.getCustomerClass(debt.customer?.name)
          }
        }
        if (!this.isSharedView) this.ensureShareToken()
      } catch (err) {
        this.error = err.message || this.text.loadFailed
      } finally {
        this.loading = false
      }
    },
    itemSummary(item) {
      const quantity = `${numberText(item.quantity)}\u4ef6`
      if (item.unitType === 'weight' && item.weight) {
        return `${quantity} · ${numberText(item.weight)}\u65a4`
      }
      return quantity
    },
    async printDebtBill() {
      if (!this.customerId || this.printing) return
      this.printing = true
      uni.showLoading({ title: `${this.text.printing}...` })
      try {
        await request({
          url: '/api/prints/customer-debt',
          method: 'POST',
          data: { customerId: this.customerId }
        })
        uni.showToast({ title: this.text.printSuccess, icon: 'success' })
      } finally {
        this.printing = false
        uni.hideLoading()
      }
    }
  }
}
</script>

<style>
.debt-page {
  background:
    radial-gradient(circle at 8% 4%, rgba(255, 191, 63, 0.16), transparent 150rpx),
    radial-gradient(circle at 94% 12%, rgba(22, 148, 95, 0.12), transparent 180rpx),
    linear-gradient(180deg, #f8fbf2 0%, #eef7ed 100%);
  color: #17362f;
}

.shop-head {
  display: flex;
  align-items: center;
  height: 108rpx;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #e5e9e7;
  background: #ffffff;
}

.shop-name {
  font-size: 34rpx;
  font-weight: 900;
}

.customer-line {
  display: flex;
  align-items: center;
  height: 84rpx;
  padding: 0 24rpx;
  background: #ffffff;
}

.customer-name {
  display: inline-flex;
  align-items: center;
  min-height: 44rpx;
  padding: 0 14rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 30rpx;
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

.customer-note {
  margin-left: 16rpx;
  color: #87929a;
  font-size: 26rpx;
}

.summary-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 18rpx 18rpx 16rpx;
  min-height: 220rpx;
  padding: 30rpx 28rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #16a66c 0%, #0f7d55 100%);
  color: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(22, 148, 95, 0.22);
}

.summary-label {
  margin-bottom: 36rpx;
  font-size: 28rpx;
  font-weight: 800;
}

.summary-money {
  font-size: 56rpx;
  font-weight: 900;
}

.summary-money text {
  margin-left: 8rpx;
  font-size: 30rpx;
}

.summary-action {
  display: block;
  min-width: 174rpx;
  height: 86rpx;
  margin: 0;
  padding: 0 18rpx;
  border: 0;
  border-radius: 12rpx;
  background: #fff6cf;
  box-shadow: 0 6rpx 14rpx rgba(0, 0, 0, 0.14);
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 86rpx;
  text-align: center;
}

.summary-actions {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.print-action {
  background: #e8f6ed;
  color: #166b4e;
}

.summary-action::after {
  display: none;
  border: 0;
}

.tabs {
  display: flex;
  margin: 0 10rpx 16rpx;
  border-radius: 10rpx;
  background: #e8f6ed;
  overflow: hidden;
}

.tab {
  position: relative;
  flex: 1;
  height: 74rpx;
  color: #4d565c;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 74rpx;
  text-align: center;
}

.tab.active {
  border-radius: 10rpx;
  background: #ffffff;
  box-shadow: 0 4rpx 10rpx rgba(25, 38, 32, 0.14);
  color: #16945f;
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
  padding: 16rpx 16rpx 36rpx;
  background: transparent;
}

.order-card {
  margin-bottom: 16rpx;
  padding: 18rpx;
  border: 1rpx solid #dfe8d8;
  border-radius: 16rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 18rpx rgba(25, 55, 44, 0.06);
}

.range-note {
  margin-bottom: 14rpx;
  color: #69757d;
  font-size: 24rpx;
  text-align: center;
}

.order-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 14rpx;
  border-bottom: 1rpx solid #edf1ef;
}

.order-date {
  font-size: 28rpx;
  font-weight: 900;
}

.order-no {
  margin-top: 4rpx;
  color: #87929a;
  font-size: 22rpx;
}

.order-amount {
  color: #16945f;
  font-size: 30rpx;
  font-weight: 900;
}

.order-amount.unpaid,
.item-total.unpaid {
  color: #d64b3f;
}

.order-amount.paid,
.item-total.paid {
  color: #16945f;
}

.order-amount.cancelled,
.item-total.cancelled {
  color: #9aa6a0;
}

.order-side {
  text-align: right;
}

.order-status {
  margin-top: 4rpx;
  color: #69757d;
  font-size: 22rpx;
  font-weight: 800;
}

.order-status.paid {
  color: #16945f;
}

.order-status.cancelled {
  color: #e85d4f;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 14rpx;
}

.item-main {
  flex: 1;
  min-width: 0;
  margin-right: 12rpx;
}

.goods-name {
  display: block;
  overflow: hidden;
  font-size: 27rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: block;
  overflow: hidden;
  margin-top: 4rpx;
  color: #69757d;
  font-size: 23rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-total {
  color: #1d2730;
  font-size: 26rpx;
  font-weight: 900;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 210rpx;
  color: #4d565c;
}

.empty-paper {
  position: relative;
  width: 132rpx;
  height: 156rpx;
  padding: 48rpx 22rpx 0;
  border-radius: 8rpx;
  background: #f7f8ff;
  box-shadow: 0 22rpx 34rpx rgba(117, 129, 156, 0.18);
  transform: rotate(-15deg);
}

.paper-clip {
  position: absolute;
  left: 42rpx;
  top: -10rpx;
  width: 48rpx;
  height: 24rpx;
  border-radius: 12rpx 12rpx 4rpx 4rpx;
  background: #d7dcf4;
}

.paper-line {
  height: 8rpx;
  margin-bottom: 16rpx;
  border-radius: 8rpx;
  background: #e1e5f2;
}

.paper-line.wide {
  width: 86rpx;
}

.paper-line.short {
  width: 58rpx;
}

.empty-text {
  margin-top: 72rpx;
  font-size: 28rpx;
}

.loading,
.error {
  margin: 24rpx;
  padding: 60rpx 20rpx;
  border-radius: 12rpx;
  background: #ffffff;
  color: #69757d;
  text-align: center;
}

.error {
  color: #d64b3f;
}
</style>
