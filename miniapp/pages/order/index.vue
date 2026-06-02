<template>
  <view class="page order-page">
    <view class="soft-card customer-card">
      <view class="customer-row">
        <text>客户</text>
        <input
          v-model="customerName"
          class="input"
          placeholder="不填默认客户"
          @input="onCustomerInput"
          @focus="searchCustomers"
        />
      </view>
      <scroll-view
        v-if="customerSuggestions.length"
        class="suggest-float"
        scroll-y
        :show-scrollbar="true"
        enhanced
      >
        <view
          v-for="customer in customerSuggestions"
          :key="customer.id"
          class="suggest-item"
          @click="selectCustomer(customer)"
        >
          {{ customer.name }}
        </view>
      </scroll-view>
    </view>

    <view class="soft-card">
      <view class="goods-head">
        <view class="section-title goods-title">选择货物</view>
        <input v-model="goodsKeyword" class="input goods-search" placeholder="搜索货物" @input="activeGoods = null" />
      </view>
      <scroll-view class="goods-scroll" scroll-y :show-scrollbar="true" enhanced>
        <view class="goods-grid">
          <view
            v-for="(goods, index) in filteredGoods"
            :key="goods.id"
            class="goods-cell"
            :class="[
              { active: activeGoods && activeGoods.id === goods.id },
              `fruit-${index % 6}`
            ]"
          >
            <view class="goods-main" @click="toggleGoods(goods)">
              <text class="goods-name">{{ goods.name }}</text>
              <text class="muted">{{ numberText(goods.stock) }}件</text>
            </view>

            <view v-if="activeGoods && activeGoods.id === goods.id" class="order-panel">
              <view class="panel-meta">售价 {{ money(form.price) }} / 售卖佣金 {{ money(form.commission) }}</view>
              <view class="form-grid">
                <view class="field-row">
                  <text class="field-label">件数</text>
                  <input v-model="form.quantity" class="input" type="digit" />
                </view>
                <view v-if="goods.unitType === 'weight'" class="field-row">
                  <text class="field-label">重量</text>
                  <input v-model="form.weight" class="input" type="digit" placeholder="斤" />
                </view>
                <view class="field-row">
                  <text class="field-label">价格</text>
                  <input v-model="form.price" class="input" type="digit" />
                </view>
                <view class="field-row">
                  <text class="field-label">售佣</text>
                  <input v-model="form.commission" class="input" type="digit" />
                </view>
              </view>
              <button class="soft-button primary" @click="addItem">加入明细 ¥{{ money(lineTotal) }}</button>
            </view>
          </view>
        </view>
      </scroll-view>
      <view v-if="!filteredGoods.length" class="empty">没有找到货物</view>
    </view>

    <view class="soft-card">
      <view class="section-title">本单明细</view>
      <view v-for="(item, index) in items" :key="index" class="detail-row">
        <text class="detail-text">{{ itemText(item) }}</text>
        <text class="detail-price">¥{{ money(item.subtotal) }}</text>
        <button class="mini-delete" @click="items.splice(index, 1)">删</button>
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
          <view class="input picker-input type-picker">{{ adjustmentTypeLabel(row.type) }}</view>
        </picker>
        <input v-model="row.amount" class="input adjustment-amount" type="digit" placeholder="金额" />
        <button class="mini-delete" @click="removeAdjustment(index)">删</button>
      </view>
      <view class="adjustment-actions">
        <text v-if="adjustments.length" class="adjustment-total">调整 {{ adjustmentTotal >= 0 ? '+' : '-' }}¥{{ money(Math.abs(adjustmentTotal)) }}</text>
        <button class="mini-add" @click="addAdjustment">+</button>
      </view>
    </view>

    <view class="total-bar">
      <text>合计 ¥{{ money(total) }}</text>
      <button class="soft-button print-button" :disabled="printing" @click="printOrder">{{ printing ? '打印中' : '打印' }}</button>
      <button class="soft-button primary" :disabled="submitting" @click="submitOrder">出单</button>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money, numberText } from '../../utils/format'

const ADJUSTMENT_NAMES = ['货拉拉', '胶框']
const ADJUSTMENT_TYPES = [
  { label: '+', value: 'add' },
  { label: '-', value: 'subtract' }
]

export default {
  data() {
    return {
      customerName: '',
      selectedCustomerId: null,
      customerSuggestions: [],
      customerTimer: null,
      goodsKeyword: '',
      goodsList: [],
      activeGoods: null,
      form: { quantity: '1', weight: '', price: '', commission: '' },
      items: [],
      adjustmentRemark: '',
      adjustments: [],
      nextAdjustmentKey: 1,
      submitting: false,
      printing: false
    }
  },
  computed: {
    filteredGoods() {
      const keyword = this.goodsKeyword.trim()
      if (!keyword) return this.goodsList
      return this.goodsList.filter(goods => goods.name.includes(keyword))
    },
    lineTotal() {
      const goods = this.activeGoods
      if (!goods) return 0
      const quantity = Number(this.form.quantity || 0)
      const weight = Number(this.form.weight || 0)
      const price = Number(this.form.price || 0)
      const commission = Number(this.form.commission || 0)
      return goods.unitType === 'weight' && weight > 0
        ? weight * price + quantity * commission
        : quantity * price + quantity * commission
    },
    total() {
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
    }
  },
  onShow() {
    if (requireLogin()) this.loadGoods()
  },
  methods: {
    money,
    numberText,
    adjustmentNameIndex(name) {
      return Math.max(ADJUSTMENT_NAMES.indexOf(name), 0)
    },
    setAdjustmentName(index, name) {
      const row = this.adjustments[index]
      if (!row) return
      row.name = name
    },
    adjustmentTypeIndex(type) {
      const index = ADJUSTMENT_TYPES.findIndex(item => item.value === type)
      return index >= 0 ? index : 0
    },
    adjustmentTypeLabel(type) {
      const option = ADJUSTMENT_TYPES.find(item => item.value === type)
      return option ? option.label : '+'
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
    changeAdjustmentName(index, event) {
      const row = this.adjustments[index]
      if (!row) return
      row.name = ADJUSTMENT_NAMES[Number(event.detail.value || 0)] || ADJUSTMENT_NAMES[0]
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
      if (this.total < 0) {
        uni.showToast({ title: '合计金额不能小于0', icon: 'none' })
        return false
      }
      return true
    },
    async loadGoods() {
      this.goodsList = await request({ url: '/api/goods' })
    },
    onCustomerInput() {
      this.selectedCustomerId = null
      clearTimeout(this.customerTimer)
      this.customerTimer = setTimeout(() => this.searchCustomers(), 250)
    },
    async searchCustomers() {
      const keyword = this.customerName.trim()
      if (!keyword) {
        this.customerSuggestions = []
        return
      }
      this.customerSuggestions = await request({ url: `/api/customers/search?q=${encodeURIComponent(keyword)}` })
    },
    selectCustomer(customer) {
      this.customerName = customer.name
      this.selectedCustomerId = customer.id
      this.customerSuggestions = []
    },
    toggleGoods(goods) {
      if (this.activeGoods && this.activeGoods.id === goods.id) {
        this.activeGoods = null
        return
      }
      this.activeGoods = goods
      this.form = {
        quantity: '1',
        weight: '',
        price: String(goods.salePrice || goods.costPrice || 0),
        commission: String(goods.saleCommission || 0)
      }
    },
    addItem() {
      const goods = this.activeGoods
      if (!goods) return
      const quantity = Number(this.form.quantity || 0)
      const weight = goods.unitType === 'weight' ? Number(this.form.weight || 0) : 0
      const price = Number(this.form.price || 0)
      const commission = Number(this.form.commission || 0)
      if (quantity <= 0 || price <= 0) {
        uni.showToast({ title: '数量和单价必须大于0', icon: 'none' })
        return
      }
      if (goods.unitType === 'weight' && weight <= 0) {
        uni.showToast({ title: '请填写重量', icon: 'none' })
        return
      }
      const subtotal = Number(this.lineTotal.toFixed(2))
      const sameItem = this.items.find(item =>
        item.goodsId === goods.id &&
        item.unitType === goods.unitType &&
        Number(item.price) === price &&
        Number(item.commission || 0) === commission
      )
      if (sameItem) {
        sameItem.quantity = Number((Number(sameItem.quantity || 0) + quantity).toFixed(2))
        sameItem.weight = goods.unitType === 'weight'
          ? Number((Number(sameItem.weight || 0) + weight).toFixed(2))
          : null
        sameItem.subtotal = Number((Number(sameItem.subtotal || 0) + subtotal).toFixed(2))
        this.activeGoods = null
        return
      }
      this.items.push({
        goodsId: goods.id,
        goodsName: goods.name,
        unitType: goods.unitType,
        quantity,
        weight: goods.unitType === 'weight' && weight > 0 ? weight : null,
        price,
        commission,
        subtotal
      })
      this.activeGoods = null
    },
    itemText(item) {
      const commissionTotal = item.unitType === 'weight'
        ? Number(item.quantity || 0) * Number(item.commission || 0)
        : Number(item.quantity || 0) * Number(item.commission || 0)
      const base = item.unitType === 'weight' && item.weight
        ? `${numberText(item.quantity)}件 ${numberText(item.weight)}斤*${money(item.price)}`
        : `${numberText(item.quantity)}件*${money(item.price)}`
      const commission = commissionTotal > 0 ? `+${money(commissionTotal)}` : ''
      return `${item.goodsName} ${base}${commission}`
    },
    submitOrder() {
      if (!this.items.length) {
        uni.showToast({ title: '请先加入明细', icon: 'none' })
        return
      }
      if (!this.validateAdjustments()) return
      uni.showModal({
        title: '确认出单',
        content: `确认出单吗？合计 ¥${money(this.total)}`,
        confirmText: '出单',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) this.createOrder()
        }
      })
    },
    async createOrder() {
      if (this.submitting) return
      this.submitting = true
      try {
        await request({
          url: '/api/orders',
          method: 'POST',
          data: {
            customerId: this.selectedCustomerId,
            customerName: this.customerName.trim(),
            items: this.items,
            adjustmentRemark: this.adjustmentRemark.trim(),
            adjustments: this.buildAdjustmentsPayload()
          }
        })
        uni.showToast({ title: '出单成功', icon: 'success' })
        this.customerName = ''
        this.selectedCustomerId = null
        this.customerSuggestions = []
        this.items = []
        this.adjustmentRemark = ''
        this.adjustments = []
        await this.loadGoods()
      } finally {
        this.submitting = false
      }
    },
    buildPrintPayload() {
      return {
        customerId: this.selectedCustomerId,
        customerName: this.customerName.trim() || '客户',
        totalAmount: Number(this.total.toFixed(2)),
        adjustmentRemark: this.adjustmentRemark.trim(),
        adjustments: this.buildAdjustmentsPayload(),
        items: this.items.map(item => ({
          goodsId: item.goodsId,
          goodsName: item.goodsName,
          unitType: item.unitType,
          quantity: Number(item.quantity || 0),
          weight: item.weight === null || item.weight === undefined ? null : Number(item.weight || 0),
          price: Number(item.price || 0),
          commission: Number(item.commission || 0),
          subtotal: Number(item.subtotal || 0)
        }))
      }
    },
    async printOrder() {
      if (!this.items.length) {
        uni.showToast({ title: '请先加入明细', icon: 'none' })
        return
      }
      if (!this.validateAdjustments()) return
      if (this.printing) return
      this.printing = true
      uni.showLoading({ title: '打印中...' })
      try {
        await request({
          url: '/api/prints/order',
          method: 'POST',
          data: this.buildPrintPayload()
        })
        uni.showToast({ title: '已发送打印', icon: 'success' })
      } finally {
        this.printing = false
        uni.hideLoading()
      }
    }
  }
}
</script>

<style scoped>
.order-page {
  padding-bottom: calc(116rpx + var(--window-bottom, 0px) + env(safe-area-inset-bottom));
}

.customer-card {
  position: relative;
  z-index: 20;
  padding: 16rpx 18rpx;
  border-color: #dbeedc;
}

.customer-row {
  display: grid;
  grid-template-columns: 64rpx minmax(0, 1fr);
  gap: 16rpx;
  align-items: center;
  font-weight: 900;
}

.suggest-float {
  position: absolute;
  left: 98rpx;
  right: 18rpx;
  top: 92rpx;
  z-index: 99;
  box-sizing: border-box;
  max-height: 168rpx;
  border: 1rpx solid #dce5dc;
  border-radius: 12rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(24, 37, 46, 0.14);
  overflow: hidden;
  width: calc(100% - 116rpx);
}

.suggest-item {
  min-height: 56rpx;
  padding: 14rpx 18rpx;
  border-bottom: 1rpx solid #eef2ee;
  font-weight: 800;
}

.goods-head {
  display: grid;
  grid-template-columns: 150rpx minmax(0, 1fr);
  gap: 14rpx;
  align-items: center;
  margin-bottom: 14rpx;
}

.goods-title {
  margin-bottom: 0;
}

.goods-search {
  min-width: 0;
  min-height: 60rpx;
  padding: 0 16rpx;
  font-size: 26rpx;
}

.goods-scroll {
  max-height: 560rpx;
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  padding-right: 6rpx;
}

.goods-cell {
  min-height: 126rpx;
  min-width: 0;
  position: relative;
  padding: 14rpx 14rpx 14rpx 54rpx;
  border: 1rpx solid #dfe8d8;
  border-radius: 14rpx;
  background: #fffef9;
  box-shadow: 0 6rpx 14rpx rgba(25, 55, 44, 0.04);
}

.goods-cell::before {
  position: absolute;
  left: 16rpx;
  top: 24rpx;
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  background: #16945f;
  box-shadow: 10rpx -8rpx 0 #d9f5e6;
  content: "";
}

.goods-cell.active {
  grid-column: 1 / -1;
  border-color: #16945f;
  background: #f2fbf4;
}

.fruit-1::before {
  background: #ff6f61;
}

.fruit-2::before {
  background: #ffbf3f;
}

.fruit-3::before {
  background: #7f63d9;
}

.fruit-4::before {
  background: #93b33b;
}

.fruit-5::before {
  background: #ff7ab1;
}

.goods-name {
  display: block;
  overflow: hidden;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-panel {
  margin-top: 12rpx;
  padding: 16rpx;
  border-radius: 14rpx;
  background: #e8f6ed;
}

.panel-meta {
  margin-bottom: 12rpx;
  color: #166b4e;
  font-weight: 900;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.field-row {
  display: grid;
  grid-template-columns: 64rpx minmax(0, 1fr);
  gap: 8rpx;
  align-items: center;
  min-width: 0;
}

.field-label {
  color: #243640;
  font-size: 24rpx;
  font-weight: 900;
  text-align: right;
  white-space: nowrap;
}

.field-row .input {
  min-width: 0;
  min-height: 64rpx;
  padding: 0 14rpx;
}

.adjustment-card {
  border-color: #dbeedc;
}

.adjustment-remark-row {
  display: grid;
  grid-template-columns: 64rpx minmax(0, 1fr);
  gap: 12rpx;
  align-items: center;
  margin-bottom: 12rpx;
}

.adjustment-row {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) 84rpx minmax(0, 1fr) 54rpx;
  gap: 10rpx;
  align-items: start;
  min-height: 66rpx;
  margin-top: 10rpx;
}

.adjustment-name-cell {
  min-width: 0;
}

.adjustment-name-input {
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
  background: #e8f6ed;
  color: #166b4e;
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
  color: #17362f;
  font-weight: 900;
}

.type-picker {
  justify-content: center;
  padding: 0;
  color: #166b4e;
  font-size: 32rpx;
}

.adjustment-amount {
  min-width: 0;
  min-height: 64rpx;
  padding: 0 14rpx;
}

.adjustment-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14rpx;
  margin-top: 14rpx;
}

.adjustment-total {
  color: #166b4e;
  font-size: 25rpx;
  font-weight: 900;
}

.mini-add {
  width: 64rpx;
  height: 54rpx;
  min-height: 54rpx;
  margin: 0;
  border-radius: 14rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 54rpx;
}

.mini-add::after {
  display: none;
  border: 0;
}

.detail-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10rpx;
  align-items: center;
  min-height: 62rpx;
  border-bottom: 1rpx solid #eef2ee;
  color: #17362f;
}

.detail-text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.detail-price {
  font-weight: 900;
}

.mini-delete {
  width: 54rpx;
  min-width: 54rpx;
  height: 50rpx;
  min-height: 50rpx;
  color: #d64b3f;
  background: transparent;
  font-size: 24rpx;
}

.empty {
  padding: 30rpx 0;
  color: #6b7780;
  text-align: center;
}

.total-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--window-bottom, 0px);
  z-index: 80;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150rpx 176rpx;
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

.total-bar .soft-button {
  width: 100%;
  height: 68rpx;
  min-height: 68rpx;
}

.total-bar .print-button {
  background: #e8f6ed;
  color: #166b4e;
}
</style>
