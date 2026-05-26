<template>
  <view class="page add-page">
    <view class="add-head">
      <view>
        <view class="head-label">东成果业</view>
        <view class="head-title">漏单加单</view>
      </view>
      <button class="refresh-button" :disabled="loadingGoods" @click="loadGoods">{{ loadingGoods ? '读取中' : '刷新' }}</button>
    </view>

    <view class="soft-card section-card">
      <view class="section-title">补录订单</view>
      <view class="date-grid">
        <picker mode="date" :value="createDate" @change="changeCreateDate">
          <view class="input picker-input">日期：{{ createDate }}</view>
        </picker>
        <picker mode="time" :value="createTime" @change="changeCreateTime">
          <view class="input picker-input">时间：{{ createTime }}</view>
        </picker>
      </view>

      <view class="customer-row">
        <input
          v-model="customerName"
          class="input"
          placeholder="客户名，不填默认客户"
          @input="onCustomerInput"
          @focus="searchCustomers"
        />
        <button class="soft-button clear-button" @click="clearCustomer">清空</button>
      </view>
      <scroll-view v-if="customerSuggestions.length" class="suggest-float" scroll-y enhanced>
        <view v-for="customer in customerSuggestions" :key="customer.id" class="suggest-item" @click="selectCustomer(customer)">
          {{ customer.name }}
        </view>
      </scroll-view>

      <view class="goods-head">
        <input v-model="goodsKeyword" class="input" placeholder="搜索货物" @input="activeGoods = null" />
      </view>
      <scroll-view class="goods-scroll" scroll-y enhanced>
        <view class="goods-grid">
          <view
            v-for="goods in filteredGoods"
            :key="goods.id"
            class="goods-cell"
            :class="{ active: activeGoods && activeGoods.id === goods.id }"
            @click="selectGoods(goods)"
          >
            <text class="goods-name">{{ goods.name }}</text>
            <text class="muted">库存 {{ numberText(goods.stock) }}件</text>
          </view>
        </view>
      </scroll-view>

      <view v-if="activeGoods" class="add-panel">
        <view class="panel-title">{{ activeGoods.name }}</view>
        <view class="edit-grid">
          <view class="field-row">
            <text>件数</text>
            <input v-model="form.quantity" class="input" type="digit" />
          </view>
          <view v-if="activeGoods.unitType === 'weight'" class="field-row">
            <text>重量</text>
            <input v-model="form.weight" class="input" type="digit" />
          </view>
          <view class="field-row">
            <text>价格</text>
            <input v-model="form.price" class="input" type="digit" />
          </view>
          <view class="field-row">
            <text>佣金</text>
            <input v-model="form.commission" class="input" type="digit" />
          </view>
        </view>
        <button class="soft-button primary add-button" @click="addItem">加入明细 ¥{{ money(lineTotal) }}</button>
      </view>

      <view v-for="(item, index) in items" :key="index" class="detail-row">
        <text class="detail-text">{{ itemText(item) }}</text>
        <text class="detail-price">¥{{ money(item.subtotal) }}</text>
        <button class="mini-delete" @click="items.splice(index, 1)">删</button>
      </view>
      <view v-if="!items.length" class="empty">还没有明细</view>

      <view class="submit-row">
        <view class="total-text">合计 ¥{{ money(total) }}</view>
        <button class="soft-button primary" :disabled="submitting" @click="submitOrder">{{ submitting ? '保存中' : '保存漏单' }}</button>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { money, numberText, todayText } from '../../../utils/format'

const today = todayText()

export default {
  data() {
    return {
      createDate: today,
      createTime: '12:00',
      customerName: '',
      selectedCustomerId: null,
      customerSuggestions: [],
      customerTimer: null,
      goodsKeyword: '',
      goodsList: [],
      loadingGoods: false,
      activeGoods: null,
      form: { quantity: '1', weight: '', price: '', commission: '' },
      items: [],
      submitting: false
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
        : quantity * price + commission
    },
    total() {
      return this.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
    }
  },
  onShow() {
    if (!requireLogin()) return
    this.loadGoods()
  },
  onUnload() {
    if (this.customerTimer) clearTimeout(this.customerTimer)
  },
  methods: {
    money,
    numberText,
    async loadGoods() {
      this.loadingGoods = true
      try {
        this.goodsList = await request({ url: '/api/goods' })
      } finally {
        this.loadingGoods = false
      }
    },
    changeCreateDate(event) {
      this.createDate = event.detail.value
    },
    changeCreateTime(event) {
      this.createTime = event.detail.value
    },
    onCustomerInput() {
      this.selectedCustomerId = null
      if (this.customerTimer) clearTimeout(this.customerTimer)
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
    clearCustomer() {
      this.customerName = ''
      this.selectedCustomerId = null
      this.customerSuggestions = []
    },
    selectGoods(goods) {
      this.activeGoods = goods
      this.form = {
        quantity: '1',
        weight: '',
        price: String(goods.salePrice || goods.costPrice || 0),
        commission: String(goods.defaultCommission || 0)
      }
    },
    addItem() {
      const goods = this.activeGoods
      if (!goods) return
      const quantity = Number(this.form.quantity || 0)
      const weight = goods.unitType === 'weight' ? Number(this.form.weight || 0) : 0
      const price = Number(this.form.price || 0)
      const commission = Number(this.form.commission || 0)
      if (quantity <= 0 || price <= 0 || (goods.unitType === 'weight' && weight <= 0)) {
        uni.showToast({ title: '件数、重量和价格必须正确填写', icon: 'none' })
        return
      }
      const subtotal = Number(this.lineTotal.toFixed(2))
      const newItem = {
        goodsId: goods.id,
        goodsName: goods.name,
        unitType: goods.unitType,
        quantity,
        weight: goods.unitType === 'weight' ? weight : null,
        price,
        commission,
        subtotal
      }
      this.items = this.mergeSameItems([...this.items, newItem])
      this.activeGoods = null
    },
    mergeSameItems(items) {
      const merged = []
      items.forEach(item => {
        const sameItem = merged.find(target =>
          target.goodsId === item.goodsId &&
          target.unitType === item.unitType &&
          Number(target.price) === Number(item.price) &&
          Number(target.commission || 0) === Number(item.commission || 0)
        )
        if (!sameItem) {
          merged.push({ ...item })
          return
        }
        sameItem.quantity = Number((Number(sameItem.quantity || 0) + Number(item.quantity || 0)).toFixed(2))
        sameItem.weight = item.unitType === 'weight'
          ? Number((Number(sameItem.weight || 0) + Number(item.weight || 0)).toFixed(2))
          : null
        sameItem.subtotal = Number((Number(sameItem.subtotal || 0) + Number(item.subtotal || 0)).toFixed(2))
      })
      return merged
    },
    itemText(item) {
      const commissionTotal = item.unitType === 'weight'
        ? Number(item.quantity || 0) * Number(item.commission || 0)
        : Number(item.commission || 0)
      const base = item.unitType === 'weight' && item.weight
        ? `${item.goodsName} ${numberText(item.quantity)}件 ${numberText(item.weight)}斤*${money(item.price)}`
        : `${item.goodsName} ${numberText(item.quantity)}件*${money(item.price)}`
      return `${base}${commissionTotal > 0 ? `+${money(commissionTotal)}` : ''}`
    },
    submitOrder() {
      if (!this.items.length) {
        uni.showToast({ title: '请先加入明细', icon: 'none' })
        return
      }
      uni.showModal({
        title: '确认保存漏单？',
        content: `${this.createDate} ${this.createTime}\n合计 ¥${money(this.total)}`,
        confirmText: '保存',
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
            createdDate: this.createDate,
            createdTime: this.createTime,
            items: this.items
          }
        })
        uni.showToast({ title: '漏单已保存', icon: 'success' })
        this.items = []
        this.activeGoods = null
        await this.loadGoods()
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.add-page {
  padding-bottom: 28rpx;
}

.add-head {
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

.refresh-button,
.clear-button {
  height: 58rpx;
  min-height: 58rpx;
  border-radius: 16rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
}

.refresh-button {
  width: 132rpx;
}

.section-card {
  position: relative;
  margin-bottom: 18rpx;
  padding: 16rpx;
}

.date-grid,
.customer-row,
.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.picker-input {
  display: flex;
  align-items: center;
}

.customer-row,
.goods-head,
.add-panel,
.submit-row {
  margin-top: 12rpx;
}

.clear-button {
  width: 104rpx;
}

.suggest-float {
  position: absolute;
  left: 16rpx;
  right: 16rpx;
  top: 206rpx;
  z-index: 30;
  max-height: 170rpx;
  border: 2rpx solid #c9dcc9;
  border-radius: 14rpx;
  background: #ffffff;
  overflow: hidden;
}

.suggest-item {
  padding: 14rpx 18rpx;
  border-bottom: 1rpx solid #eef2ee;
  font-weight: 900;
}

.goods-scroll {
  max-height: 330rpx;
  margin-top: 12rpx;
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
}

.goods-cell {
  display: grid;
  gap: 4rpx;
  min-width: 0;
  padding: 14rpx;
  border: 2rpx solid #d7ead9;
  border-radius: 14rpx;
  background: #ffffff;
}

.goods-cell.active {
  border-color: #16945f;
  background: #e8f6ed;
}

.goods-name {
  overflow: hidden;
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-panel {
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f2fbf4;
}

.panel-title {
  margin-bottom: 12rpx;
  color: #17362f;
  font-weight: 900;
}

.field-row {
  display: grid;
  grid-template-columns: 64rpx minmax(0, 1fr);
  gap: 8rpx;
  align-items: center;
  font-size: 24rpx;
  font-weight: 900;
}

.add-button {
  width: 100%;
  margin-top: 12rpx;
}

.detail-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10rpx;
  align-items: center;
  min-height: 66rpx;
  border-bottom: 1rpx solid #eef2ee;
}

.detail-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-price,
.total-text {
  color: #16945f;
  font-weight: 900;
}

.mini-delete {
  width: 54rpx;
  height: 50rpx;
  min-height: 50rpx;
  background: transparent;
  color: #d64b3f;
  font-size: 24rpx;
}

.submit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190rpx;
  gap: 12rpx;
  align-items: center;
}

.empty {
  padding: 28rpx 0;
  color: #718078;
  text-align: center;
}

.add-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(36, 82, 119, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f6fbff 0%, #eef7ff 100%);
}

.soft-card,
.customer-card,
.goods-card,
.detail-card {
  border-color: #c9dcea;
  background: linear-gradient(145deg, #ffffff 0%, #f2f8ff 100%);
}

.section-title,
.goods-name,
.detail-text {
  color: #17364e;
}

.goods-cell.active {
  border-color: #245277;
  background: #e4f0fa;
}

.detail-price,
.total-text {
  color: #245277;
}

.soft-button:not(.danger),
.suggest-item:active {
  background: #e4f0fa;
  color: #245277;
}

.primary {
  background: #245277;
  color: #ffffff;
}
</style>
