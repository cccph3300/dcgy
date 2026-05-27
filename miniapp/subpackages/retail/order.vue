<template>
  <view class="page retail-order">
    <view class="soft-card customer-card">
      <view class="field-row">
        <text>客户</text>
        <input v-model.trim="customerName" class="input" placeholder="客户姓名" />
      </view>
      <view class="field-row">
        <text>电话</text>
        <input v-model.trim="customerPhone" class="input" placeholder="可空" />
      </view>
      <view class="field-row">
        <text>备注</text>
        <input v-model.trim="remark" class="input" placeholder="可空" />
      </view>
    </view>

    <view class="soft-card">
      <view class="goods-head">
        <view class="section-title">选择商品</view>
        <input v-model.trim="keyword" class="input goods-search" placeholder="搜索商品" />
      </view>
      <scroll-view class="product-scroll" scroll-y :show-scrollbar="true" enhanced>
        <view v-for="product in filteredProducts" :key="product.id" class="product-cell" :class="{ active: activeProduct && activeProduct.id === product.id }">
          <view class="product-main" @click="toggleProduct(product)">
            <view>
              <view class="product-name">{{ product.name }}</view>
              <view class="product-meta">{{ product.categoryText }} · {{ unitText(product.unitType) }} · ¥{{ money(product.price) }}</view>
            </view>
          </view>

          <view v-if="activeProduct && activeProduct.id === product.id" class="order-panel">
            <view class="form-grid">
              <view class="field">
                <view class="field-label">数量</view>
                <input v-model="form.quantity" class="input" type="digit" />
              </view>
              <view v-if="product.unitType === 'weight'" class="field">
                <view class="field-label">重量</view>
                <input v-model="form.weight" class="input" type="digit" placeholder="斤" />
              </view>
            </view>
            <button class="soft-button primary" @click="addItem">加入明细 ¥{{ money(lineTotal) }}</button>
          </view>
        </view>
      </scroll-view>
      <view v-if="!filteredProducts.length" class="empty">暂无可售商品</view>
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

    <view class="total-bar">
      <text>合计 ¥{{ money(total) }}</text>
      <button class="soft-button primary" :disabled="submitting" @click="submitOrder">{{ submitting ? '出单中' : '出单' }}</button>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money, numberText } from '../../utils/format'
import { unitText } from './constants'

export default {
  data() {
    return {
      customerName: '',
      customerPhone: '',
      remark: '',
      keyword: '',
      products: [],
      activeProduct: null,
      form: { quantity: '1', weight: '' },
      items: [],
      submitting: false
    }
  },
  computed: {
    filteredProducts() {
      const keyword = this.keyword.trim()
      if (!keyword) return this.products
      return this.products.filter(product => product.name.includes(keyword))
    },
    lineTotal() {
      const product = this.activeProduct
      if (!product) return 0
      const quantity = Number(this.form.quantity || 0)
      const weight = Number(this.form.weight || 0)
      const price = Number(product.price || 0)
      const commission = Number(product.commission || 0)
      return product.unitType === 'weight' ? weight * price + quantity * commission : quantity * price + quantity * commission
    },
    total() {
      return this.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
    }
  },
  onShow() {
    if (requireLogin()) this.loadProducts()
  },
  methods: {
    money,
    numberText,
    unitText,
    async loadProducts() {
      this.products = await request({ url: '/api/retail/products/public' })
    },
    toggleProduct(product) {
      if (this.activeProduct && this.activeProduct.id === product.id) {
        this.activeProduct = null
        return
      }
      this.activeProduct = product
      this.form = { quantity: '1', weight: '' }
    },
    addItem() {
      const product = this.activeProduct
      if (!product) return
      const quantity = Number(this.form.quantity || 0)
      const weight = Number(this.form.weight || 0)
      if (quantity <= 0) {
        uni.showToast({ title: '数量必须大于0', icon: 'none' })
        return
      }
      if (product.unitType === 'weight' && weight <= 0) {
        uni.showToast({ title: '请填写重量', icon: 'none' })
        return
      }
      this.items.push({
        productId: product.id,
        goodsName: product.name,
        unitType: product.unitType,
        quantity,
        weight: product.unitType === 'weight' ? weight : null,
        price: Number(product.price || 0),
        commission: Number(product.commission || 0),
        subtotal: Number(this.lineTotal.toFixed(2))
      })
      this.activeProduct = null
    },
    itemText(item) {
      const base = item.unitType === 'weight' && item.weight
        ? `${numberText(item.quantity)}件 ${numberText(item.weight)}斤*${money(item.price)}`
        : `${numberText(item.quantity)}件*${money(item.price)}`
      const commissionTotal = Number(item.quantity || 0) * Number(item.commission || 0)
      const commission = commissionTotal > 0 ? `+${money(commissionTotal)}` : ''
      return `${item.goodsName} ${base}${commission}`
    },
    submitOrder() {
      if (!this.customerName.trim()) {
        uni.showToast({ title: '请填写客户姓名', icon: 'none' })
        return
      }
      if (!this.items.length) {
        uni.showToast({ title: '请先加入明细', icon: 'none' })
        return
      }
      uni.showModal({
        title: '确认出单',
        content: `${this.customerName} 合计 ¥${money(this.total)}`,
        confirmText: '出单',
        success: (res) => {
          if (res.confirm) this.createOrder()
        }
      })
    },
    async createOrder() {
      this.submitting = true
      try {
        await request({
          url: '/api/retail/orders',
          method: 'POST',
          data: {
            customerName: this.customerName,
            customerPhone: this.customerPhone,
            remark: this.remark,
            items: this.items
          }
        })
        uni.showToast({ title: '出单成功', icon: 'success' })
        this.customerName = ''
        this.customerPhone = ''
        this.remark = ''
        this.items = []
        await this.loadProducts()
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.retail-order {
  padding-bottom: calc(116rpx + var(--window-bottom, 0px) + env(safe-area-inset-bottom));
}

.customer-card {
  display: grid;
  gap: 12rpx;
}

.field-row {
  display: grid;
  grid-template-columns: 68rpx minmax(0, 1fr);
  gap: 14rpx;
  align-items: center;
  font-weight: 900;
}

.goods-head {
  display: grid;
  grid-template-columns: 150rpx minmax(0, 1fr);
  gap: 14rpx;
  align-items: center;
  margin-bottom: 14rpx;
}

.goods-search {
  min-height: 60rpx;
}

.product-scroll {
  max-height: 520rpx;
}

.product-cell {
  margin-bottom: 12rpx;
  padding: 16rpx;
  border: 1rpx solid #dfe8d8;
  border-radius: 16rpx;
  background: #fffef9;
}

.product-cell.active {
  border-color: #16945f;
  background: #f2fbf4;
}

.product-name {
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
}

.product-meta {
  margin-top: 8rpx;
  color: #718078;
  font-size: 23rpx;
}

.order-panel {
  margin-top: 14rpx;
  padding: 16rpx;
  border-radius: 14rpx;
  background: #e8f6ed;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.field-label {
  margin-bottom: 8rpx;
  color: #17362f;
  font-size: 24rpx;
  font-weight: 900;
}

.detail-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10rpx;
  align-items: center;
  min-height: 62rpx;
  border-bottom: 1rpx solid #eef2ee;
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
  grid-template-columns: minmax(0, 1fr) 176rpx;
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

.retail-order {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(11, 154, 135, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f2fffb 0%, #e7fbf6 100%);
}

.soft-card,
.customer-card {
  border-color: #bde5df;
  background: linear-gradient(145deg, #ffffff 0%, #effdfa 100%);
}

.section-title,
.goods-name,
.detail-text {
  color: #0d4d45;
}

.goods-cell.active {
  border-color: #0b9a87;
  background: #e7fbf6;
}

.total-bar {
  border-top-color: #bde5df;
  background: #f2fffb;
  color: #0d4d45;
}

.primary,
.total-bar .primary {
  background: #0b9a87;
  color: #ffffff;
}
</style>
