<template>
  <view class="page account-detail">
    <view class="soft-card head-card">
      <button class="soft-button" @click="goBack">返回</button>
      <view class="head-actions">
        <button v-if="entry && entry.supplierId" class="soft-button bill" @click="openSupplierDebt">查看总账单</button>
        <button v-if="entry && entry.status === 'unpaid'" class="soft-button pay" @click="payEntry">标记已付清</button>
        <button v-if="entry && entry.status === 'paid'" class="soft-button danger" :disabled="deleting" @click="deleteEntry">
          {{ deleting ? '删除中' : '删除' }}
        </button>
      </view>
    </view>

    <view v-if="loading" class="soft-card empty">正在读取入账详情...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <template v-else-if="entry">
      <view class="soft-card summary-card">
        <view>
          <text class="muted">货主</text>
          <text class="strong">{{ entry.supplierName }}</text>
        </view>
        <view>
          <text class="muted">时间</text>
          <text class="strong">{{ timeText(entry.createdAt) }}</text>
        </view>
        <view>
          <text class="muted">总额</text>
          <text class="strong amount">¥{{ money(entry.totalAmount) }}</text>
        </view>
        <view>
          <text class="muted">状态</text>
          <text class="status" :class="entry.status">{{ statusText(entry.status) }}</text>
        </view>
      </view>

      <view class="soft-card content-card">
        <view class="section-title">入账内容</view>
        <view class="item-line">
          <view>
            <view class="goods-name">{{ entry.goodsName }}</view>
            <view class="item-meta">{{ itemSummary(entry) }}</view>
          </view>
          <text class="item-total">¥{{ money(entry.totalAmount) }}</text>
        </view>
        <view class="total-row">
          <text>总金额：</text>
          <text>¥{{ money(entry.totalAmount) }}</text>
        </view>
      </view>

      <view class="soft-card detail-card">
        <view class="detail-row"><text>总佣金</text><text>¥{{ money(entry.totalCommission) }}</text></view>
        <view class="detail-row"><text>成本价</text><text>¥{{ money(entry.costPrice) }}{{ entry.unitType === 'weight' ? '/斤' : '/件' }}</text></view>
        <view class="detail-row"><text>每件佣金</text><text>¥{{ money(entry.commission) }}/件</text></view>
        <view class="detail-row"><text>售卖价</text><text>¥{{ money(entry.salePrice) }}</text></view>
        <view class="detail-row"><text>入库方式</text><text>{{ stockModeText(entry.stockMode) }}</text></view>
        <view class="detail-row"><text>单号</text><text>{{ entry.entryNo }}</text></view>
      </view>
    </template>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { money, numberText, timeText } from '../../../utils/format'

export default {
  data() {
    return {
      id: '',
      entry: null,
      loading: true,
      error: '',
      deleting: false
    }
  },
  onLoad(query) {
    this.id = query.id || ''
  },
  onShow() {
    if (requireLogin()) this.loadDetail()
  },
  methods: {
    money,
    numberText,
    timeText,
    statusText(status) {
      return status === 'paid' ? '已付清' : '未付'
    },
    stockModeText(mode) {
      return mode === 'auto_stocked' ? '未入库，已自动入库' : '已入库，只记录'
    },
    itemSummary(entry) {
      const quantity = `${numberText(entry.quantity)}件`
      if (entry.unitType === 'weight' && entry.weight) {
        return `${quantity} · ${numberText(entry.weight)}斤 · 成本${money(entry.costPrice)}/斤 · 佣金${money(entry.commission)}/件`
      }
      return `${quantity} · 成本${money(entry.costPrice)}/件 · 佣金${money(entry.commission)}/件`
    },
    goBack() {
      uni.navigateBack({ delta: 1 })
    },
    openSupplierDebt() {
      if (!this.entry?.supplierId) return
      uni.navigateTo({ url: `/subpackages/other/accounts/debt?supplierId=${this.entry.supplierId}` })
    },
    async loadDetail() {
      this.loading = true
      this.error = ''
      try {
        this.entry = await request({ url: `/api/supplier-entries/${this.id}` })
      } catch (err) {
        this.error = err.message || '入账详情读取失败'
      } finally {
        this.loading = false
      }
    },
    payEntry() {
      if (!this.entry) return
      uni.showModal({
        title: '确认付清',
        content: `货主：${this.entry.supplierName}\n品名：${this.entry.goodsName}\n总金额：¥${money(this.entry.totalAmount)}`,
        confirmText: '付清',
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/supplier-entries/${this.id}/pay`, method: 'PATCH' })
          uni.showToast({ title: '已付清', icon: 'success' })
          this.loadDetail()
        }
      })
    },
    deleteEntry() {
      if (!this.entry || this.entry.status !== 'paid') return
      uni.showModal({
        title: '删除入账记录？',
        content: `操作不可逆。\n货主：${this.entry.supplierName}\n品名：${this.entry.goodsName}\n总金额：￥${money(this.entry.totalAmount)}\n确认删除吗？`,
        confirmText: '删除',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          this.deleting = true
          try {
            await request({ url: `/api/supplier-entries/${this.id}`, method: 'DELETE' })
            uni.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => {
              uni.navigateBack({ delta: 1 })
            }, 350)
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
.head-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 14rpx;
}

.head-card .soft-button {
  height: 56rpx;
  min-height: 56rpx;
  padding: 0 18rpx;
  font-size: 24rpx;
}

.head-actions {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 10rpx;
  justify-content: flex-end;
  min-width: 0;
}

.pay {
  background: #16945f;
  color: #ffffff;
}

.bill {
  background: #fff6cf;
  color: #166b4e;
}

.danger {
  background: #fff0ee;
  color: #d64b3f;
}

.summary-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  background: linear-gradient(135deg, #ffffff 0%, #f2fbf4 100%);
}

.summary-card view {
  display: grid;
  gap: 4rpx;
}

.strong {
  overflow: hidden;
  color: #17362f;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  color: #16945f;
}

.status {
  width: fit-content;
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

.content-card,
.detail-card {
  padding: 22rpx;
}

.item-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #edf1ef;
}

.goods-name {
  overflow: hidden;
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  margin-top: 8rpx;
  color: #69757d;
  font-size: 24rpx;
}

.item-total {
  flex: 0 0 auto;
  color: #16945f;
  font-size: 28rpx;
  font-weight: 900;
}

.total-row {
  display: flex;
  justify-content: flex-end;
  gap: 12rpx;
  padding-top: 18rpx;
  color: #16945f;
  font-size: 34rpx;
  font-weight: 900;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eef2ee;
  color: #415149;
  font-weight: 900;
}

.detail-row text:last-child {
  color: #17362f;
  text-align: right;
}

.empty {
  padding: 42rpx 0;
  color: #718078;
  text-align: center;
}

.error {
  color: #d64b3f;
}

.account-detail {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(217, 120, 23, 0.14), transparent 190rpx),
    linear-gradient(180deg, #fffaf0 0%, #fff3dc 100%);
}

.head-card,
.summary-card,
.content-card,
.detail-card {
  border-color: #efd7aa;
  background: linear-gradient(145deg, #ffffff 0%, #fff8e8 100%);
}

.pay {
  background: #d97817;
}

.bill {
  background: #fff1d1;
  color: #6f3d05;
}

.danger {
  background: #fff0ee;
  color: #d64b3f;
}

.section-title,
.strong,
.goods-name,
.detail-row text:last-child {
  color: #6f3d05;
}

.amount,
.item-total,
.total-row,
.status.paid {
  color: #d97817;
}

.status.paid {
  background: #fff1d1;
}
</style>
