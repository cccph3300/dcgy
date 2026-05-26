<template>
  <view class="debt-page">
    <view v-if="loading" class="loading">正在读取货主欠账...</view>
    <view v-else-if="error" class="error">{{ error }}</view>

    <view v-else-if="debt">
      <view class="shop-head">
        <view class="shop-name">东成果业</view>
      </view>

      <view class="supplier-line">
        <text class="supplier-name">{{ debt.supplier.name }}</text>
        <text class="supplier-note">货主欠账单</text>
      </view>

      <view class="summary-card">
        <view class="summary-main">
          <view class="summary-title">赊欠金额</view>
          <view class="summary-row">
            <text class="summary-label">总欠账：</text>
            <text class="summary-value">¥{{ amountText(debt, 'totalDebt', 'totalAmount') }}/{{ debt.entryCount }}单</text>
          </view>
          <view class="summary-row">
            <text class="summary-label">部分还款：</text>
            <text class="summary-value">¥{{ amountText(debt, 'partialPayment') }}</text>
          </view>
          <view class="summary-row unpaid-row">
            <text class="summary-label">未付：</text>
            <text class="summary-unpaid">¥{{ amountText(debt, 'unpaidAmount') }}</text>
          </view>
        </view>
        <view v-if="!isSharedView" class="summary-actions">
          <button class="summary-action repay-action" @click="openPartialPayment">部分还款</button>
          <!-- #ifdef MP-WEIXIN -->
          <button class="summary-action share-action" :disabled="!shareToken || preparingShare" open-type="share">
            {{ preparingShare ? '准备分享...' : '分享账单 >' }}
          </button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <button class="summary-action share-action" @click="ignoreWebShare">分享账单 ></button>
          <!-- #endif -->
        </view>
      </view>

      <view class="tabs">
        <view class="tab" :class="{ active: activeTab === 'debt' }" @click="activeTab = 'debt'">赊欠订单</view>
        <view class="tab" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">
          全部账单
          <text v-if="debt.allEntryCount" class="dot"></text>
        </view>
      </view>

      <view class="content">
        <view v-if="activeTab === 'all'" class="range-note">只显示最近一年的账单</view>
        <view v-if="!visibleEntries.length" class="empty-state">暂无数据</view>

        <view v-for="entry in visibleEntries" :key="entry.id" class="entry-card">
          <view class="entry-head">
            <view>
              <view class="entry-date">{{ dateText(entry.createdAt) }}</view>
              <view class="entry-no">单号 {{ entry.entryNo }}</view>
            </view>
            <view class="entry-side">
              <view class="entry-state">
                <view class="entry-amount" :class="entry.status">¥{{ amountText(entry, 'totalAmount') }}</view>
                <view class="entry-status" :class="entry.status">{{ statusText(entry.status) }}</view>
              </view>
              <button v-if="!isSharedView && entry.status === 'unpaid'" class="pay-action" :disabled="payingEntryId === entry.id" @click="confirmPayEntry(entry)">
                {{ payingEntryId === entry.id ? '付清中' : '付清' }}
              </button>
              <button v-if="!isSharedView && activeTab === 'all' && entry.status === 'paid'" class="delete-action" :disabled="deletingEntryId === entry.id" @click="confirmDeleteEntry(entry)">
                删除
              </button>
            </view>
          </view>

          <view class="item-row" @click="openDetail(entry.id)">
            <view class="item-main">
              <text class="goods-name">{{ entry.goodsName }}</text>
              <text class="item-meta">{{ itemSummary(entry) }}</text>
            </view>
            <text class="item-total" :class="entry.status">¥{{ amountText(entry, 'totalAmount') }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="!isSharedView && repayDialogVisible" class="modal-mask" @click="closePartialPayment">
      <view class="repay-dialog" @click.stop>
        <view class="repay-title">部分还款</view>
        <input v-model="repayAmount" class="repay-input" type="digit" placeholder="请输入部分还款金额" focus />
        <view class="repay-actions">
          <button class="repay-cancel" @click="closePartialPayment">取消</button>
          <button class="repay-confirm" @click="submitPartialPayment">确认</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { dateText, money, numberText } from '../../../utils/format'

export default {
  data() {
    return {
      supplierId: '',
      shareToken: '',
      isSharedView: false,
      debt: null,
      activeTab: 'debt',
      loading: true,
      error: '',
      payingEntryId: null,
      deletingEntryId: null,
      preparingShare: false,
      repayDialogVisible: false,
      repayAmount: ''
    }
  },
  computed: {
    visibleEntries() {
      if (!this.debt) return []
      return this.activeTab === 'all' ? (this.debt.allEntries || []) : (this.debt.entries || [])
    }
  },
  onLoad(query) {
    this.supplierId = query.supplierId || ''
    this.shareToken = query.token || ''
    this.isSharedView = query.share === '1'
    if (this.isSharedView) this.activeTab = 'debt'
  },
  onShow() {
    if (this.isSharedView || requireLogin()) this.loadDebt()
  },
  onShareAppMessage() {
    const supplierName = this.debt?.supplier?.name || ''
    return {
      title: `${supplierName}的货主欠账单`,
      path: `/subpackages/other/accounts/debt?supplierId=${this.supplierId}&share=1&token=${encodeURIComponent(this.shareToken)}`
    }
  },
  methods: {
    dateText,
    money,
    numberText,
    statusText(status) {
      return status === 'paid' ? '已付清' : '未付'
    },
    amountText(source, ...keys) {
      const target = source || {}
      for (const key of keys) {
        if (target[key] !== undefined && target[key] !== null && target[key] !== '') {
          return money(target[key])
        }
      }
      return money(0)
    },
    itemSummary(entry) {
      const quantity = `${numberText(entry.quantity)}件`
      if (entry.unitType === 'weight' && entry.weight) {
        return `${quantity} · ${numberText(entry.weight)}斤 · 成本${money(entry.costPrice)}/斤 · 佣金${money(entry.commission)}/件`
      }
      return `${quantity} · 成本${money(entry.costPrice)}/件 · 佣金${money(entry.commission)}/件`
    },
    async ensureShareToken() {
      if (this.shareToken) return this.shareToken
      if (!this.supplierId || this.preparingShare || this.isSharedView) return ''
      this.preparingShare = true
      try {
        const result = await request({ url: `/api/suppliers/${this.supplierId}/debt-share` })
        this.shareToken = result.token
        return this.shareToken
      } finally {
        this.preparingShare = false
      }
    },
    ignoreWebShare() {
      // H5/APP 没有微信 open-type 分享能力，这里保持无操作，避免误导为系统分享。
    },
    async loadDebt() {
      this.loading = true
      this.error = ''
      try {
        const url = this.isSharedView
          ? `/api/share/supplier-debts/${this.supplierId}?token=${encodeURIComponent(this.shareToken)}`
          : `/api/suppliers/${this.supplierId}/debts`
        this.debt = await request({ url, auth: !this.isSharedView })
        if (!this.isSharedView) this.ensureShareToken()
      } catch (err) {
        this.error = err.message || '货主欠账读取失败'
      } finally {
        this.loading = false
      }
    },
    openDetail(id) {
      uni.navigateTo({ url: `/subpackages/other/accounts/detail?id=${id}` })
    },
    openPartialPayment() {
      this.repayAmount = this.amountText(this.debt, 'partialPayment')
      this.repayDialogVisible = true
    },
    closePartialPayment() {
      this.repayDialogVisible = false
      this.repayAmount = ''
    },
    async submitPartialPayment() {
      const amount = Number(this.repayAmount)
      if (!Number.isFinite(amount) || amount < 0) {
        uni.showToast({ title: '请输入正确金额', icon: 'none' })
        return
      }
      await request({
        url: `/api/suppliers/${this.supplierId}/partial-payment`,
        method: 'PATCH',
        data: { amount }
      })
      uni.showToast({ title: '已记录还款', icon: 'success' })
      this.closePartialPayment()
      this.loadDebt()
    },
    confirmPayEntry(entry) {
      uni.showModal({
        title: '确认付清',
        content: `${entry.supplierName} ${dateText(entry.createdAt)}\n¥${this.amountText(entry, 'totalAmount')}\n确认付清？`,
        success: async (res) => {
          if (!res.confirm) return
          this.payingEntryId = entry.id
          try {
            await request({ url: `/api/supplier-entries/${entry.id}/pay`, method: 'PATCH' })
            uni.showToast({ title: '已付清', icon: 'success' })
            await this.loadDebt()
          } finally {
            this.payingEntryId = null
          }
        }
      })
    },
    confirmDeleteEntry(entry) {
      uni.showModal({
        title: '删除已付清账单？',
        content: `操作不可逆。\n${entry.stockMode === 'auto_stocked' ? '该记录会同时回滚库存。' : '该记录只会删除入账记录。'}\n${entry.goodsName} ¥${this.amountText(entry, 'totalAmount')}`,
        confirmText: '删除',
        confirmColor: '#d64b3f',
        success: async (res) => {
          if (!res.confirm) return
          this.deletingEntryId = entry.id
          try {
            await request({ url: `/api/supplier-entries/${entry.id}`, method: 'DELETE' })
            uni.showToast({ title: '已删除', icon: 'success' })
            await this.loadDebt()
          } finally {
            this.deletingEntryId = null
          }
        }
      })
    }
  }
}
</script>

<style scoped>
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
  justify-content: space-between;
  gap: 18rpx;
  height: 108rpx;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #e5e9e7;
  background: #ffffff;
}

.shop-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 34rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supplier-line {
  display: flex;
  align-items: center;
  height: 84rpx;
  padding: 0 24rpx;
  background: #ffffff;
}

.supplier-name {
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

.supplier-note {
  margin-left: 16rpx;
  color: #87929a;
  font-size: 26rpx;
}

.summary-card {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 20rpx;
  margin: 18rpx 18rpx 16rpx;
  min-height: 232rpx;
  padding: 28rpx;
  border: 1rpx solid #dfe8d8;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #ffffff 0%, #f2fbf4 100%);
  box-shadow: 0 12rpx 28rpx rgba(22, 148, 95, 0.14);
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
  color: #166b4e;
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
  color: #4d565c;
  font-size: 27rpx;
  font-weight: 800;
}

.summary-value {
  overflow: hidden;
  color: #17362f;
  font-size: 31rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-unpaid {
  overflow: hidden;
  color: #d64b3f;
  font-size: 54rpx;
  font-weight: 900;
  line-height: 1.08;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 34rpx;
}

.summary-action {
  display: block;
  min-width: 190rpx;
  height: 88rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 12rpx;
  border: 0;
  background: #16945f;
  color: #ffffff;
  font-size: 29rpx;
  font-weight: 900;
  line-height: 88rpx;
  text-align: center;
}

.share-action {
  background: #fff6cf;
  color: #17362f;
}

.share-action[disabled] {
  opacity: 0.68;
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
}

.entry-card {
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

.entry-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 14rpx;
  border-bottom: 1rpx solid #edf1ef;
}

.entry-date {
  font-size: 28rpx;
  font-weight: 900;
}

.entry-no {
  margin-top: 4rpx;
  color: #87929a;
  font-size: 22rpx;
}

.entry-side {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 14rpx;
  text-align: right;
}

.entry-amount,
.item-total {
  color: #d64b3f;
  font-size: 30rpx;
  font-weight: 900;
}

.entry-amount.paid,
.item-total.paid {
  color: #16945f;
}

.entry-status {
  margin-top: 4rpx;
  color: #69757d;
  font-size: 22rpx;
  font-weight: 800;
}

.entry-status.paid {
  color: #16945f;
}

.pay-action,
.delete-action {
  width: 104rpx;
  height: 52rpx;
  min-height: 52rpx;
  margin: 6rpx 0 0;
  padding: 0;
  border-radius: 12rpx;
  border: 0;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 52rpx;
}

.pay-action {
  background: #16945f;
}

.delete-action {
  background: #d64b3f;
}

.pay-action::after,
.delete-action::after {
  display: none;
  border: 0;
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

.empty-state,
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

.modal-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  background: rgba(18, 33, 28, 0.42);
}

.repay-dialog {
  width: 100%;
  max-width: 560rpx;
  padding: 28rpx;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 42rpx rgba(18, 33, 28, 0.24);
}

.repay-title {
  color: #17362f;
  font-size: 32rpx;
  font-weight: 900;
}

.repay-input {
  height: 78rpx;
  margin-top: 22rpx;
  padding: 0 18rpx;
  border: 2rpx solid #c9dcc9;
  border-radius: 12rpx;
  background: #f7fbf3;
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
}

.repay-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  margin-top: 24rpx;
}

.repay-cancel,
.repay-confirm {
  height: 70rpx;
  margin: 0;
  border-radius: 12rpx;
  border: 0;
  font-size: 27rpx;
  font-weight: 900;
  line-height: 70rpx;
}

.repay-cancel {
  background: #edf2eb;
  color: #4d565c;
}

.repay-confirm {
  background: #16945f;
  color: #ffffff;
}

.repay-cancel::after,
.repay-confirm::after {
  display: none;
  border: 0;
}

.debt-page {
  background:
    radial-gradient(circle at 8% 4%, rgba(217, 120, 23, 0.16), transparent 150rpx),
    radial-gradient(circle at 94% 12%, rgba(255, 191, 63, 0.12), transparent 180rpx),
    linear-gradient(180deg, #fffaf0 0%, #fff3dc 100%);
}

.supplier-name,
.tab.active,
.summary-title,
.entry-status.paid {
  color: #d97817;
}

.supplier-name,
.tabs,
.status.paid {
  background: #fff1d1;
}

.summary-card,
.entry-card,
.repay-dialog {
  border-color: #efd7aa;
  background: linear-gradient(135deg, #ffffff 0%, #fff8e8 100%);
}

.repay-action,
.pay-action,
.repay-confirm {
  background: #d97817;
}

.share-action {
  background: #fff6cf;
  color: #17362f;
}

.summary-unpaid,
.entry-amount,
.item-total {
  color: #d64b3f;
}

.entry-amount.paid,
.item-total.paid {
  color: #d97817;
}
</style>
