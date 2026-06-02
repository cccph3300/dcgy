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
          <text class="field-label">售佣</text>
          <input v-model="form.commission" class="input" type="digit" />
        </view>
        <view class="field-row">
          <text class="field-label">成本</text>
          <input v-model="form.costPrice" class="input" type="digit" />
        </view>
        <view class="field-row">
          <text class="field-label">成佣</text>
          <input v-model="form.costCommission" class="input" type="digit" />
        </view>
      </view>

      <button class="soft-button primary add-button" @click="saveItem">{{ editingItemIndex === null ? '加入明细' : '保存明细' }} ¥{{ money(lineTotal) }}</button>
    </view>

    <view class="soft-card detail-card">
      <view class="section-title">送货明细</view>
      <view v-for="(item, index) in items" :key="index" class="item-row" :class="{ editing: editingItemIndex === index }" @click="editItem(index)">
        <view class="item-main">
          <text class="item-name">{{ item.goodsName }}</text>
          <text class="muted">{{ item.type === 'own' ? '自家商品' : '代采购' }} · {{ itemSummary(item) }}</text>
        </view>
        <view class="item-side">
          <text>¥{{ money(item.subtotal) }}</text>
          <button class="mini-delete" @click.stop="removeItem(index)">删</button>
        </view>
      </view>
      <view v-if="!items.length" class="empty">还没有明细</view>
    </view>

    <view class="soft-card adjustment-card">
      <view class="adjustment-remark-row">
        <text class="field-label">备注</text>
        <input v-model="adjustmentRemark" class="input" placeholder="如路费和退框" />
      </view>
      <view v-for="(row, index) in adjustments" :key="row.key" class="adjustment-row">
        <view class="adjustment-name-cell">
          <input v-model="row.name" class="input adjustment-name-input" placeholder="名称" />
          <view class="name-quick-actions">
            <button v-for="name in adjustmentNameOptions" :key="name" class="name-quick" @click="setAdjustmentName(index, name)">{{ name }}</button>
          </view>
        </view>
        <picker :range="adjustmentTypeLabels" :value="adjustmentTypeIndex(row.type)" @change="changeAdjustmentType(index, $event)">
          <view class="input picker-input type-picker">{{ adjustmentSign(row.type) }}</view>
        </picker>
        <input v-model="row.amount" class="input adjustment-amount" type="digit" placeholder="金额" />
        <button class="mini-delete" @click="removeAdjustment(index)">删</button>
      </view>
      <view class="adjustment-actions">
        <text v-if="adjustments.length" class="adjustment-total">调整 {{ adjustmentTotal >= 0 ? '+' : '-' }}¥{{ money(Math.abs(adjustmentTotal)) }}</text>
        <button class="mini-add" @click="addAdjustment">+</button>
      </view>
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
  costCommission: '',
  costPrice: ''
})

const ADJUSTMENT_NAMES = ['货拉拉', '胶框']
const ADJUSTMENT_TYPES = [
  { label: '+', value: 'add' },
  { label: '-', value: 'subtract' }
]

export default {
  data() {
    return {
      marketName: '',
      goodsKeyword: '',
      goodsList: [],
      selectedGoods: null,
      form: emptyForm(),
      items: [],
      adjustmentRemark: '',
      adjustments: [],
      nextAdjustmentKey: 1,
      editingItemIndex: null,
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
      return Number((this.goodsTotal + this.adjustmentTotal).toFixed(2))
    },
    goodsTotal() {
      return Number(this.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0).toFixed(2))
    },
    adjustmentTotal() {
      return Number(this.adjustments.reduce((sum, item) => {
        const amount = Number(item.amount || 0)
        if (!Number.isFinite(amount) || amount <= 0) return sum
        return sum + (item.type === 'subtract' ? -amount : amount)
      }, 0).toFixed(2))
    },
    adjustmentNameOptions() {
      return ADJUSTMENT_NAMES
    },
    adjustmentTypeLabels() {
      return ADJUSTMENT_TYPES.map(item => item.label)
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
    adjustmentTypeIndex(type) {
      const index = ADJUSTMENT_TYPES.findIndex(item => item.value === type)
      return index >= 0 ? index : 0
    },
    adjustmentSign(type) {
      return type === 'subtract' ? '-' : '+'
    },
    addAdjustment() {
      this.adjustments.push({
        key: this.nextAdjustmentKey++,
        name: '',
        type: 'add',
        amount: ''
      })
    },
    removeAdjustment(index) {
      this.adjustments.splice(index, 1)
    },
    setAdjustmentName(index, name) {
      const row = this.adjustments[index]
      if (!row) return
      row.name = name
    },
    changeAdjustmentType(index, event) {
      const row = this.adjustments[index]
      if (!row) return
      const option = ADJUSTMENT_TYPES[Number(event.detail.value || 0)] || ADJUSTMENT_TYPES[0]
      row.type = option.value
    },
    buildAdjustmentsPayload() {
      return this.adjustments
        .filter(item => item.name || Number(item.amount || 0) > 0)
        .map(item => ({
          name: item.name,
          type: item.type,
          amount: Number(item.amount || 0)
        }))
    },
    validateAdjustments() {
      const invalid = this.buildAdjustmentsPayload().some(item => {
        return !item.name || (item.type !== 'add' && item.type !== 'subtract') || !Number.isFinite(item.amount) || item.amount <= 0
      })
      if (invalid) {
        uni.showToast({ title: '请检查备注调整金额', icon: 'none' })
        return false
      }
      if (this.totalAmount < 0) {
        uni.showToast({ title: '合计金额不能小于0', icon: 'none' })
        return false
      }
      return true
    },
    async loadGoods() {
      this.goodsList = await request({ url: '/api/goods' })
    },
    async loadOrder() {
      const order = await request({ url: `/api/supermarket-orders/${this.id}` })
      this.marketName = order.supermarketName || ''
      this.adjustmentRemark = order.adjustmentRemark || ''
      this.adjustments = (order.adjustments || []).map(item => ({
        id: item.id,
        key: this.nextAdjustmentKey++,
        name: item.name,
        type: item.type,
        amount: String(item.amount || '')
      }))
      this.items = (order.items || []).map(item => ({
        type: item.type || (item.goodsId ? 'own' : 'purchase'),
        goodsId: item.goodsId || null,
        goodsName: item.goodsName,
        quantity: Number(item.quantity || 0),
        weight: item.weight === null || item.weight === undefined ? null : Number(item.weight || 0),
        price: Number(item.price || 0),
        commission: Number(item.commission || 0),
        costCommission: Number(item.costCommission || 0),
        costPrice: Number(item.costPrice || 0),
        unitType: item.unitType,
        subtotal: Number(item.subtotal || 0)
      }))
    },
    unitText(unitType) {
      return unitType === 'weight' ? '按重量' : '按件数'
    },
    switchType(type) {
      this.editingItemIndex = null
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
        commission: String(goods.saleCommission || 0),
        costCommission: String(goods.defaultCommission || 0)
      }
    },
    calcSubtotal(item) {
      const quantity = Number(item.quantity || 0)
      const weight = Number(item.weight || 0)
      const price = Number(item.price || 0)
      const commission = Number(item.commission || 0)
      return weight > 0
        ? Number((weight * price + quantity * commission).toFixed(2))
        : Number((quantity * price + quantity * commission).toFixed(2))
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
      if (Number(this.form.costCommission || 0) < 0) {
        uni.showToast({ title: '成佣不能小于0', icon: 'none' })
        return false
      }
      return true
    },
    editItem(index) {
      const item = this.items[index]
      if (!item) return
      this.editingItemIndex = index
      const type = item.type || (item.goodsId ? 'own' : 'purchase')
      this.form = {
        ...emptyForm(),
        type,
        goodsId: item.goodsId || null,
        goodsName: item.goodsName || '',
        quantity: String(item.quantity || 1),
        weight: item.weight === null || item.weight === undefined ? '' : String(item.weight || ''),
        price: String(item.price || ''),
        commission: String(item.commission || ''),
        costCommission: String(item.costCommission || ''),
        costPrice: String(item.costPrice || '')
      }
      if (type === 'own') {
        const goods = this.goodsList.find(goods => goods.id === item.goodsId)
        this.selectedGoods = goods || {
          id: item.goodsId,
          name: item.goodsName,
          unitType: item.unitType || 'qty'
        }
        this.goodsKeyword = item.goodsName || ''
      } else {
        this.selectedGoods = null
        this.goodsKeyword = ''
      }
    },
    removeItem(index) {
      this.items.splice(index, 1)
      if (this.editingItemIndex === index) {
        const nextType = this.form.type
        this.selectedGoods = null
        this.goodsKeyword = ''
        this.form = { ...emptyForm(), type: nextType }
        this.editingItemIndex = null
      } else if (this.editingItemIndex !== null && this.editingItemIndex > index) {
        this.editingItemIndex -= 1
      }
    },
    saveItem() {
      if (!this.validateForm()) return
      const subtotal = this.calcSubtotal(this.form)
      const item = {
        type: this.form.type,
        goodsId: this.form.type === 'own' ? this.form.goodsId : null,
        goodsName: this.form.goodsName.trim(),
        quantity: Number(this.form.quantity || 0),
        weight: this.form.weight === '' ? null : Number(this.form.weight || 0),
        price: Number(this.form.price || 0),
        commission: Number(this.form.commission || 0),
        costCommission: Number(this.form.costCommission || 0),
        costPrice: Number(this.form.costPrice || 0),
        unitType: this.form.type === 'own' ? (this.selectedGoods?.unitType || 'qty') : (Number(this.form.weight || 0) > 0 ? 'weight' : 'qty'),
        subtotal
      }
      if (this.editingItemIndex === null) {
        this.items.push(item)
      } else {
        this.items.splice(this.editingItemIndex, 1, item)
      }
      const nextType = this.form.type
      this.selectedGoods = null
      this.goodsKeyword = ''
      this.form = { ...emptyForm(), type: nextType }
      this.editingItemIndex = null
    },
    hasDraftContent() {
      return Boolean(this.marketName.trim() || this.items.length || this.adjustmentRemark.trim() || this.adjustments.length || this.form.goodsName || this.form.goodsId || this.form.price || this.form.costPrice || this.form.costCommission || this.goodsKeyword)
    },
    draftPayload() {
      return {
        marketName: this.marketName,
        goodsKeyword: this.goodsKeyword,
        form: this.form,
        items: this.items,
        adjustmentRemark: this.adjustmentRemark,
        adjustments: this.adjustments
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
      this.adjustmentRemark = draft.adjustmentRemark || ''
      this.adjustments = Array.isArray(draft.adjustments)
        ? draft.adjustments.map(item => ({ key: this.nextAdjustmentKey++, name: item.name || '', type: item.type || 'add', amount: item.amount || '' }))
        : []
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
      if (!this.validateAdjustments()) return
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
            items: this.items,
            adjustmentRemark: this.adjustmentRemark.trim(),
            adjustments: this.buildAdjustmentsPayload()
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
  min-height: 100vh;
  padding-bottom: calc(116rpx + var(--window-bottom, 0px) + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 10% 4%, rgba(77, 110, 216, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f6f8ff 0%, #eef3ff 100%);
}

.shop-card,
.add-card,
.detail-card,
.adjustment-card {
  padding: 18rpx;
  border-color: #cdd8fb;
  background: linear-gradient(145deg, #ffffff 0%, #f4f7ff 100%);
  box-shadow: 0 12rpx 26rpx rgba(52, 73, 140, 0.09);
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
  color: #24305a;
  font-size: 24rpx;
  font-weight: 900;
  text-align: right;
}

.adjustment-remark-row {
  display: grid;
  grid-template-columns: 68rpx minmax(0, 1fr);
  gap: 10rpx;
  align-items: center;
  margin-bottom: 12rpx;
}

.adjustment-row {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) 84rpx minmax(0, 1fr) 60rpx;
  gap: 10rpx;
  align-items: start;
  min-height: 66rpx;
  margin-top: 10rpx;
}

.adjustment-name-cell {
  min-width: 0;
}

.adjustment-name-input,
.adjustment-amount {
  min-width: 0;
  min-height: 64rpx;
  padding: 0 14rpx;
}

.name-quick-actions {
  display: flex;
  gap: 8rpx;
  margin-top: 8rpx;
}

.name-quick {
  width: auto;
  height: 42rpx;
  min-height: 42rpx;
  margin: 0;
  padding: 0 14rpx;
  border-radius: 12rpx;
  background: #d9e8ff;
  color: #254ea8;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 42rpx;
}

.name-quick::after {
  display: none;
  border: 0;
}

.picker-input {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  min-width: 0;
  min-height: 64rpx;
  padding: 0 14rpx;
  color: #18366f;
  font-weight: 900;
}

.type-picker {
  justify-content: center;
  padding: 0;
  color: #2f68d8;
  font-size: 32rpx;
}

.adjustment-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14rpx;
  margin-top: 14rpx;
}

.adjustment-total {
  color: #2f68d8;
  font-size: 25rpx;
  font-weight: 900;
}

.mini-add {
  width: 64rpx;
  height: 54rpx;
  min-height: 54rpx;
  margin: 0;
  border-radius: 14rpx;
  background: #d9e8ff;
  color: #2f68d8;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 54rpx;
}

.mini-add::after {
  display: none;
  border: 0;
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
  background: #e9eefb;
  color: #66749a;
  font-size: 26rpx;
  font-weight: 900;
}

.tab-button.active {
  background: #4d6ed8;
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
  border: 1rpx solid #d9e1fb;
  border-radius: 14rpx;
  background: #ffffff;
}

.goods-cell.active {
  border-color: #4d6ed8;
  background: #eef3ff;
}

.goods-name,
.item-name {
  display: block;
  overflow: hidden;
  color: #1f2f63;
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
  border-bottom: 1rpx solid #e7ecfa;
}

.item-main {
  min-width: 0;
}

.item-side {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #4d6ed8;
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
  color: #697597;
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
  border-top: 1rpx solid #cdd8fb;
  background: #f8faff;
  box-shadow: 0 -8rpx 22rpx rgba(52, 73, 140, 0.12);
  color: #1f2f63;
  font-size: 32rpx;
  font-weight: 900;
}

.total-bar.editing {
  grid-template-columns: minmax(0, 1fr) 176rpx;
}

.add-button,
.total-bar .primary {
  background: #4d6ed8;
  color: #ffffff;
}

.total-bar .soft-button:not(.primary) {
  background: #e9eefb;
  color: #24305a;
}
</style>
