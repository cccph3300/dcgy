<template>
  <view class="page delivery-create">
    <view class="soft-card shop-card">
      <view class="field-row full">
        <text class="field-label">超市</text>
        <input v-model="marketName" class="input" placeholder="填写超市名称" />
      </view>
    </view>

    <view class="soft-card add-card">
      <view class="section-title">添加商品</view>
      <view class="type-tabs">
        <button class="tab-button" :class="{ active: form.type === 'own' }" @click="switchType('own')">自家商品</button>
        <button class="tab-button" :class="{ active: form.type === 'purchase' }" @click="switchType('purchase')">代采购</button>
      </view>

      <template v-if="form.type === 'own'">
        <view class="goods-head">
          <input v-model="goodsKeyword" class="input" placeholder="搜索库存商品" @input="selectedGoods = null" />
        </view>
        <scroll-view v-if="filteredGoods.length" class="goods-scroll" scroll-y :show-scrollbar="true" enhanced>
          <view class="goods-grid">
            <view
              v-for="goods in filteredGoods"
              :key="goods.id"
              class="goods-cell"
              :class="{ active: selectedGoods && selectedGoods.id === goods.id }"
              @click="selectGoods(goods)"
            >
              <text class="goods-name">{{ goods.name }}</text>
              <text class="muted">{{ numberText(goods.stock) }}件 · {{ unitText(goods.unitType) }}</text>
            </view>
          </view>
        </scroll-view>
        <view v-if="!filteredGoods.length" class="empty">没有找到库存商品</view>
      </template>

      <view v-else class="field-row full">
        <text class="field-label">品名</text>
        <input v-model="form.goodsName" class="input" placeholder="水果名称" />
      </view>

      <view class="form-grid">
        <view class="field-row">
          <text class="field-label">数量</text>
          <input v-model="form.quantity" class="input" type="digit" />
        </view>
        <view class="field-row">
          <text class="field-label">重量</text>
          <input v-model="form.weight" class="input" type="digit" :placeholder="weightPlaceholder" />
        </view>
        <view class="field-row">
          <text class="field-label">价格</text>
          <input v-model="form.price" class="input" type="digit" />
        </view>
        <view class="field-row">
          <text class="field-label">佣金</text>
          <input v-model="form.commission" class="input" type="digit" />
        </view>
        <view class="field-row">
          <text class="field-label">成本</text>
          <input v-model="form.costPrice" class="input" type="digit" />
        </view>
      </view>

      <button class="soft-button primary add-button" @click="addItem">加入明细 ¥{{ money(lineTotal) }}</button>
    </view>

    <view class="soft-card detail-card">
      <view class="section-title">送货明细</view>
      <view v-for="(item, index) in items" :key="index" class="item-row">
        <view class="item-main">
          <text class="item-name">{{ item.goodsName }}</text>
          <text class="muted">{{ item.type === 'own' ? '自家商品' : '代采购' }} · {{ itemSummary(item) }}</text>
        </view>
        <view class="item-side">
          <text>¥{{ money(item.subtotal) }}</text>
          <button class="mini-delete" @click="items.splice(index, 1)">删</button>
        </view>
      </view>
      <view v-if="!items.length" class="empty">还没有明细</view>
    </view>

    <view class="total-bar" :class="{ editing: id }">
      <text>合计 ¥{{ money(totalAmount) }}</text>
      <button v-if="!id" class="soft-button" @click="saveDraft">保存</button>
      <button class="soft-button primary" :disabled="submitting" @click="submitOrder">{{ submitting ? (id ? '保存中' : '出单中') : (id ? '保存修改' : '出单') }}</button>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money, numberText } from '../../utils/format'
import { DELIVERY_CREATE_DRAFT_KEY } from '../../config/api'

const emptyForm = () => ({
  type: 'own',
  goodsId: null,
  goodsName: '',
  quantity: '1',
  weight: '',
  price: '',
  commission: '',
  costPrice: ''
})

export default {
  data() {
    return {
      marketName: '',
      goodsKeyword: '',
      goodsList: [],
      selectedGoods: null,
      form: emptyForm(),
      items: [],
      id: '',
      submitting: false,
      allowLeave: false,
      savedDraftText: ''
    }
  },
  computed: {
    filteredGoods() {
      const keyword = this.goodsKeyword.trim()
      if (!keyword) return this.goodsList
      return this.goodsList.filter(goods => goods.name.includes(keyword))
    },
    lineTotal() {
      return this.calcSubtotal(this.form)
    },
    totalAmount() {
      return this.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
    },
    weightPlaceholder() {
      return this.form.type === 'own' && this.selectedGoods?.unitType === 'weight' ? '必填' : '可空'
    }
  },
  onShow() {
    if (requireLogin()) this.loadGoods()
  },
  onLoad(query) {
    this.id = query.id || ''
    uni.setNavigationBarTitle({ title: this.id ? '超市配送/超市订单/编辑送货单' : '超市配送/新建送货单' })
    if (this.id) {
      this.loadOrder()
    } else {
      this.restoreDraft()
    }
  },
  onBackPress() {
    if (this.id || this.allowLeave || !this.hasUnsavedContent()) return false
    this.confirmLeave()
    return true
  },
  methods: {
    money,
    numberText,
    async loadGoods() {
      this.goodsList = await request({ url: '/api/goods' })
    },
    async loadOrder() {
      const order = await request({ url: `/api/supermarket-orders/${this.id}` })
      this.marketName = order.supermarketName || ''
      this.items = (order.items || []).map(item => ({
        type: item.type || (item.goodsId ? 'own' : 'purchase'),
        goodsId: item.goodsId || null,
        goodsName: item.goodsName,
        quantity: Number(item.quantity || 0),
        weight: item.weight === null || item.weight === undefined ? null : Number(item.weight || 0),
        price: Number(item.price || 0),
        commission: Number(item.commission || 0),
        costPrice: Number(item.costPrice || 0),
        subtotal: Number(item.subtotal || 0)
      }))
    },
    unitText(unitType) {
      return unitType === 'weight' ? '按重量' : '按件数'
    },
    switchType(type) {
      this.selectedGoods = null
      this.goodsKeyword = ''
      this.form = { ...emptyForm(), type }
    },
    selectGoods(goods) {
      this.selectedGoods = goods
      this.goodsKeyword = goods.name
      this.form = {
        ...this.form,
        type: 'own',
        goodsId: goods.id,
        goodsName: goods.name,
        price: String(goods.salePrice || goods.costPrice || 0),
        costPrice: String(goods.costPrice || 0),
        commission: String(goods.defaultCommission || 0)
      }
    },
    calcSubtotal(item) {
      const quantity = Number(item.quantity || 0)
      const weight = Number(item.weight || 0)
      const price = Number(item.price || 0)
      const commission = Number(item.commission || 0)
      return weight > 0
        ? Number((weight * price + commission).toFixed(2))
        : Number((quantity * price + commission).toFixed(2))
    },
    itemSummary(item) {
      const weight = Number(item.weight || 0)
      const quantity = `${numberText(item.quantity)}件`
      return weight > 0
        ? `${quantity} · ${numberText(weight)}斤 · ¥${money(item.price)}`
        : `${quantity} · ¥${money(item.price)}`
    },
    validateForm() {
      if (!this.marketName.trim()) {
        uni.showToast({ title: '请填写超市名称', icon: 'none' })
        return false
      }
      if (this.form.type === 'own' && !this.form.goodsId) {
        uni.showToast({ title: '请选择库存商品', icon: 'none' })
        return false
      }
      if (this.form.type === 'own' && this.selectedGoods?.unitType === 'weight' && Number(this.form.weight || 0) <= 0) {
        uni.showToast({ title: '按重量商品必须填写重量', icon: 'none' })
        return false
      }
      if (this.form.type === 'purchase' && !this.form.goodsName.trim()) {
        uni.showToast({ title: '请填写商品名', icon: 'none' })
        return false
      }
      if (Number(this.form.quantity || 0) <= 0 || Number(this.form.price || 0) <= 0) {
        uni.showToast({ title: '数量和价格必须大于0', icon: 'none' })
        return false
      }
      if (this.form.type === 'purchase' && Number(this.form.costPrice || 0) < 0) {
        uni.showToast({ title: '成本不能小于0', icon: 'none' })
        return false
      }
      return true
    },
    addItem() {
      if (!this.validateForm()) return
      const subtotal = this.calcSubtotal(this.form)
      this.items.push({
        type: this.form.type,
        goodsId: this.form.type === 'own' ? this.form.goodsId : null,
        goodsName: this.form.goodsName.trim(),
        quantity: Number(this.form.quantity || 0),
        weight: this.form.weight === '' ? null : Number(this.form.weight || 0),
        price: Number(this.form.price || 0),
        commission: Number(this.form.commission || 0),
        costPrice: Number(this.form.costPrice || 0),
        subtotal
      })
      const nextType = this.form.type
      this.selectedGoods = null
      this.goodsKeyword = ''
      this.form = { ...emptyForm(), type: nextType }
    },
    hasDraftContent() {
      return Boolean(this.marketName.trim() || this.items.length || this.form.goodsName || this.form.goodsId || this.form.price || this.form.costPrice || this.goodsKeyword)
    },
    draftPayload() {
      return {
        marketName: this.marketName,
        goodsKeyword: this.goodsKeyword,
        form: this.form,
        items: this.items
      }
    },
    draftText() {
      return JSON.stringify(this.draftPayload())
    },
    saveDraft(options = {}) {
      uni.setStorageSync(DELIVERY_CREATE_DRAFT_KEY, this.draftPayload())
      this.savedDraftText = this.draftText()
      if (!options.silent) uni.showToast({ title: '已保存草稿', icon: 'success' })
    },
    restoreDraft() {
      const draft = uni.getStorageSync(DELIVERY_CREATE_DRAFT_KEY)
      if (!draft) return
      this.marketName = draft.marketName || ''
      this.goodsKeyword = draft.goodsKeyword || ''
      this.form = { ...emptyForm(), ...(draft.form || {}) }
      this.items = Array.isArray(draft.items) ? draft.items : []
      this.savedDraftText = this.draftText()
    },
    clearDraft() {
      uni.removeStorageSync(DELIVERY_CREATE_DRAFT_KEY)
    },
    hasUnsavedContent() {
      return this.hasDraftContent() && this.draftText() !== this.savedDraftText
    },
    leavePage() {
      this.allowLeave = true
      uni.navigateBack({ delta: 1 })
    },
    confirmLeave() {
      uni.showModal({
        title: '是否保存当前内容',
        content: '保存后下次回来会继续显示；不保存则下次进入是新页面。',
        cancelText: '不保存',
        confirmText: '保存',
        success: (res) => {
          if (res.confirm) {
            this.saveDraft({ silent: true })
          } else {
            this.clearDraft()
          }
          this.leavePage()
        }
      })
    },
    submitOrder() {
      if (!this.marketName.trim()) {
        uni.showToast({ title: '请填写超市名称', icon: 'none' })
        return
      }
      if (!this.items.length) {
        uni.showToast({ title: '请先加入明细', icon: 'none' })
        return
      }
      uni.showModal({
        title: this.id ? '确认保存' : '确认出单',
        content: this.id ? `合计 ¥${money(this.totalAmount)}` : `超市：${this.marketName.trim()}\n总金额：¥${money(this.totalAmount)}`,
        confirmText: this.id ? '保存' : '出单',
        success: (res) => {
          if (res.confirm) this.createOrder()
        }
      })
    },
    async createOrder() {
      if (this.submitting) return
      this.submitting = true
      try {
        const result = await request({
          url: this.id ? `/api/supermarket-orders/${this.id}` : '/api/supermarket-orders',
          method: this.id ? 'PUT' : 'POST',
          data: {
            supermarketName: this.marketName.trim(),
            items: this.items
          }
        })
        uni.showToast({ title: this.id ? '已保存' : '已出单', icon: 'success' })
        if (!this.id) this.clearDraft()
        const id = result.id || result.order?.id || this.id
        if (this.id) {
          uni.navigateBack({ delta: 1 })
        } else if (id) {
          uni.redirectTo({ url: `/subpackages/delivery/detail?id=${id}` })
        } else {
          uni.navigateBack({ delta: 1 })
        }
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.delivery-create {
  padding-bottom: calc(116rpx + var(--window-bottom, 0px) + env(safe-area-inset-bottom));
}

.shop-card,
.add-card,
.detail-card {
  padding: 18rpx;
}

.field-row {
  display: grid;
  grid-template-columns: 68rpx minmax(0, 1fr);
  gap: 10rpx;
  align-items: center;
  min-width: 0;
}

.field-row.full {
  grid-template-columns: 76rpx minmax(0, 1fr);
}

.field-label {
  color: #243640;
  font-size: 24rpx;
  font-weight: 900;
  text-align: right;
}

.type-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.tab-button {
  height: 64rpx;
  min-height: 64rpx;
  border-radius: 14rpx;
  background: #edf2eb;
  color: #718078;
  font-size: 26rpx;
  font-weight: 900;
}

.tab-button.active {
  background: #16945f;
  color: #ffffff;
}

.goods-head {
  margin-bottom: 12rpx;
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.goods-scroll {
  max-height: 348rpx;
}

.goods-cell {
  min-height: 104rpx;
  padding: 14rpx;
  border: 1rpx solid #dfe8d8;
  border-radius: 14rpx;
  background: #fffef9;
}

.goods-cell.active {
  border-color: #16945f;
  background: #e8f6ed;
}

.goods-name,
.item-name {
  display: block;
  overflow: hidden;
  color: #17362f;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.form-grid .input {
  min-width: 0;
  padding: 0 14rpx;
}

.add-button {
  width: 100%;
  margin-top: 16rpx;
}

.item-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12rpx;
  align-items: center;
  min-height: 74rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #eef2ee;
}

.item-main {
  min-width: 0;
}

.item-side {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #16945f;
  font-weight: 900;
}

.mini-delete {
  width: 54rpx;
  height: 48rpx;
  min-height: 48rpx;
  border-radius: 12rpx;
  background: #ffece8;
  color: #d64b3f;
  font-size: 24rpx;
}

.empty {
  padding: 30rpx 0;
  color: #718078;
  text-align: center;
}

.total-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--window-bottom, 0px);
  z-index: 80;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132rpx 132rpx;
  gap: 14rpx;
  align-items: center;
  min-height: 90rpx;
  padding: 10rpx 18rpx;
  border-top: 1rpx solid #cfe6d5;
  background: #ffffff;
  box-shadow: 0 -8rpx 22rpx rgba(25, 55, 44, 0.1);
  font-size: 32rpx;
  font-weight: 900;
}

.total-bar.editing {
  grid-template-columns: minmax(0, 1fr) 176rpx;
}
</style>
