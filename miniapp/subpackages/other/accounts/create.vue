<template>
  <view class="page account-create">
    <view class="soft-card supplier-card">
      <view class="field-row full">
        <text class="field-label">货主</text>
        <input
          v-model.trim="supplierName"
          class="input"
          placeholder="填写货主名称"
          @input="onSupplierInput"
          @focus="searchSuppliers"
        />
      </view>
      <scroll-view v-if="supplierSuggestions.length" class="suggest-float" scroll-y enhanced>
        <view
          v-for="supplier in supplierSuggestions"
          :key="supplier.id"
          class="suggest-item"
          @click="selectSupplier(supplier)"
        >
          {{ supplier.name }}
        </view>
      </scroll-view>
    </view>

    <view class="soft-card form-card">
      <view class="section-title">入账</view>
      <view class="form-grid">
        <view class="field-row full-span">
          <text class="field-label">品名</text>
          <input
            v-model.trim="form.goodsName"
            class="input"
            placeholder="水果名称"
            @input="onGoodsInput"
            @focus="searchGoods"
          />
          <scroll-view v-if="goodsSuggestions.length" class="suggest-float goods-suggest-float" scroll-y enhanced>
            <view
              v-for="goods in goodsSuggestions"
              :key="goods.id"
              class="suggest-item"
              @click="selectGoods(goods)"
            >
              {{ goods.name }}
            </view>
          </scroll-view>
        </view>
        <picker :value="unitIndex" :range="unitOptions" range-key="label" @change="changeUnit">
          <view class="input picker-input">{{ unitOptions[unitIndex].label }}</view>
        </picker>
        <picker :value="stockIndex" :range="stockOptions" range-key="label" @change="changeStockMode">
          <view class="input picker-input">{{ stockOptions[stockIndex].label }}</view>
        </picker>
        <input v-model="form.quantity" class="input" type="digit" placeholder="数量/件" />
        <input v-if="form.unitType === 'weight'" v-model="form.weight" class="input" type="digit" placeholder="总重量/斤" />
        <input v-model="form.totalAmount" class="input" type="digit" placeholder="总金额" />
        <input v-model="form.totalCommission" class="input" type="digit" placeholder="总佣金 可空" />
        <input v-model="form.salePrice" class="input" type="digit" placeholder="售卖价" />
      </view>

      <view class="calc-card">
        <view>
          <text>自动成本</text>
          <view>¥{{ money(costPrice) }}{{ form.unitType === 'weight' ? '/斤' : '/件' }}</view>
        </view>
        <view>
          <text>每件佣金</text>
          <view>¥{{ money(commission) }}</view>
        </view>
      </view>
    </view>

    <view class="total-bar">
      <text>合计 ¥{{ money(Number(form.totalAmount || 0)) }}</text>
      <button class="soft-button primary" :disabled="submitting" @click="submitEntry">{{ submitting ? '保存中' : '保存入账' }}</button>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { money } from '../../../utils/format'

const emptyForm = () => ({
  goodsName: '',
  unitType: 'weight',
  stockMode: 'auto_stocked',
  quantity: '',
  weight: '',
  totalAmount: '',
  totalCommission: '',
  salePrice: ''
})

export default {
  data() {
    return {
      supplierName: '',
      selectedSupplierId: null,
      supplierSuggestions: [],
      supplierTimer: null,
      goodsSuggestions: [],
      goodsTimer: null,
      form: emptyForm(),
      submitting: false,
      unitOptions: [
        { label: '按重量计费', value: 'weight' },
        { label: '按件数计费', value: 'qty' }
      ],
      stockOptions: [
        { label: '未入库：自动入库+记录', value: 'auto_stocked' },
        { label: '已入库：只记录', value: 'record_only' }
      ]
    }
  },
  computed: {
    unitIndex() {
      return this.form.unitType === 'qty' ? 1 : 0
    },
    stockIndex() {
      return this.form.stockMode === 'record_only' ? 1 : 0
    },
    commission() {
      const quantity = Number(this.form.quantity || 0)
      const totalCommission = Number(this.form.totalCommission || 0)
      if (quantity <= 0 || totalCommission <= 0) return 0
      return Number((totalCommission / quantity).toFixed(2))
    },
    costPrice() {
      const totalAmount = Number(this.form.totalAmount || 0)
      const totalCommission = Number(this.form.totalCommission || 0)
      const costTotal = Math.max(totalAmount - totalCommission, 0)
      if (this.form.unitType === 'weight') {
        const weight = Number(this.form.weight || 0)
        return weight > 0 ? Number((costTotal / weight).toFixed(2)) : 0
      }
      const quantity = Number(this.form.quantity || 0)
      return quantity > 0 ? Number((costTotal / quantity).toFixed(2)) : 0
    }
  },
  onShow() {
    requireLogin()
  },
  onUnload() {
    if (this.supplierTimer) clearTimeout(this.supplierTimer)
    if (this.goodsTimer) clearTimeout(this.goodsTimer)
  },
  methods: {
    money,
    onSupplierInput() {
      this.selectedSupplierId = null
      if (this.supplierTimer) clearTimeout(this.supplierTimer)
      this.supplierTimer = setTimeout(() => this.searchSuppliers(), 250)
    },
    async searchSuppliers() {
      const keyword = this.supplierName.trim()
      if (!keyword) {
        this.supplierSuggestions = []
        return
      }
      this.supplierSuggestions = await request({ url: `/api/suppliers/search?q=${encodeURIComponent(keyword)}` })
    },
    selectSupplier(supplier) {
      this.supplierName = supplier.name
      this.selectedSupplierId = supplier.id
      this.supplierSuggestions = []
    },
    onGoodsInput() {
      if (this.goodsTimer) clearTimeout(this.goodsTimer)
      this.goodsTimer = setTimeout(() => this.searchGoods(), 220)
    },
    async searchGoods() {
      const keyword = this.form.goodsName.trim()
      if (!keyword) {
        this.goodsSuggestions = []
        return
      }
      const result = await request({ url: `/api/goods?q=${encodeURIComponent(keyword)}&page=1&pageSize=8` })
      this.goodsSuggestions = Array.isArray(result) ? result : (result?.items || [])
    },
    selectGoods(goods) {
      this.form.goodsName = goods.name
      this.form.unitType = goods.unitType === 'weight' ? 'weight' : 'qty'
      if (this.form.unitType === 'qty') this.form.weight = ''
      if (!this.form.salePrice) this.form.salePrice = String(goods.salePrice || goods.costPrice || '')
      this.goodsSuggestions = []
    },
    changeUnit(event) {
      this.form.unitType = this.unitOptions[Number(event.detail.value)].value
      if (this.form.unitType === 'qty') this.form.weight = ''
    },
    changeStockMode(event) {
      this.form.stockMode = this.stockOptions[Number(event.detail.value)].value
    },
    validateForm() {
      if (!this.supplierName.trim()) {
        uni.showToast({ title: '请填写货主', icon: 'none' })
        return false
      }
      if (!this.form.goodsName.trim()) {
        uni.showToast({ title: '请填写品名', icon: 'none' })
        return false
      }
      if (Number(this.form.quantity || 0) <= 0) {
        uni.showToast({ title: '请填写数量', icon: 'none' })
        return false
      }
      if (this.form.unitType === 'weight' && Number(this.form.weight || 0) <= 0) {
        uni.showToast({ title: '请填写总重量', icon: 'none' })
        return false
      }
      if (Number(this.form.totalAmount || 0) <= 0) {
        uni.showToast({ title: '请填写总金额', icon: 'none' })
        return false
      }
      if (Number(this.form.totalCommission || 0) > Number(this.form.totalAmount || 0)) {
        uni.showToast({ title: '总佣金不能大于总金额', icon: 'none' })
        return false
      }
      if (Number(this.form.salePrice || 0) <= 0) {
        uni.showToast({ title: '请填写售卖价', icon: 'none' })
        return false
      }
      return true
    },
    submitEntry() {
      if (!this.validateForm()) return
      const stockText = this.form.stockMode === 'auto_stocked' ? '未入库，将自动入库' : '已入库，只记录'
      uni.showModal({
        title: '确认入账',
        content: `货主：${this.supplierName.trim()}\n品名：${this.form.goodsName.trim()}\n总金额：¥${money(this.form.totalAmount)}\n${stockText}`,
        confirmText: '入账',
        success: (res) => {
          if (res.confirm) this.createEntry()
        }
      })
    },
    async createEntry() {
      if (this.submitting) return
      this.submitting = true
      try {
        const result = await request({
          url: '/api/supplier-entries',
          method: 'POST',
          data: {
            supplierName: this.supplierName.trim(),
            goodsName: this.form.goodsName.trim(),
            unitType: this.form.unitType,
            stockMode: this.form.stockMode,
            quantity: Number(this.form.quantity || 0),
            weight: this.form.unitType === 'weight' ? Number(this.form.weight || 0) : null,
            totalAmount: Number(this.form.totalAmount || 0),
            totalCommission: Number(this.form.totalCommission || 0),
            salePrice: Number(this.form.salePrice || 0)
          }
        })
        uni.showToast({ title: '已入账', icon: 'success' })
        this.form = emptyForm()
        this.supplierSuggestions = []
        this.goodsSuggestions = []
        if (result?.id) {
          setTimeout(() => {
            uni.navigateTo({ url: `/subpackages/other/accounts/detail?id=${result.id}` })
          }, 350)
        }
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.account-create {
  padding-bottom: calc(116rpx + var(--window-bottom, 0px) + env(safe-area-inset-bottom));
}

.supplier-card {
  position: relative;
  z-index: 20;
  padding: 16rpx 18rpx;
}

.form-card {
  padding: 18rpx;
}

.field-row {
  display: grid;
  grid-template-columns: 76rpx minmax(0, 1fr);
  gap: 12rpx;
  align-items: center;
}

.field-row.full-span {
  grid-column: 1 / -1;
  position: relative;
}

.field-label {
  color: #243640;
  font-size: 24rpx;
  font-weight: 900;
  text-align: right;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.picker-input {
  display: flex;
  align-items: center;
}

.suggest-float {
  position: absolute;
  left: 106rpx;
  right: 18rpx;
  top: 92rpx;
  z-index: 99;
  max-height: 188rpx;
  border: 1rpx solid #dce5dc;
  border-radius: 12rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(24, 37, 46, 0.14);
  overflow: hidden;
}

.suggest-item {
  min-height: 56rpx;
  padding: 14rpx 18rpx;
  border-bottom: 1rpx solid #eef2ee;
  font-weight: 800;
}

.goods-suggest-float {
  left: 88rpx;
  right: 0;
  top: 68rpx;
}

.calc-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.calc-card > view {
  min-height: 96rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #e8f6ed;
}

.calc-card text {
  color: #718078;
  font-size: 22rpx;
  font-weight: 900;
}

.calc-card view view {
  margin-top: 8rpx;
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
}

.total-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--window-bottom, 0px);
  z-index: 80;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190rpx;
  gap: 14rpx;
  align-items: center;
  min-height: 90rpx;
  padding: 10rpx 18rpx;
  border-top: 1rpx solid #cfe6d5;
  background: #ffffff;
  box-shadow: 0 -8rpx 22rpx rgba(25, 55, 44, 0.1);
  color: #17362f;
  font-size: 32rpx;
  font-weight: 900;
}

.account-create {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(217, 120, 23, 0.14), transparent 190rpx),
    linear-gradient(180deg, #fffaf0 0%, #fff3dc 100%);
}

.supplier-card,
.form-card {
  border-color: #efd7aa;
  background: linear-gradient(145deg, #ffffff 0%, #fff8e8 100%);
  box-shadow: 0 12rpx 26rpx rgba(132, 77, 12, 0.08);
}

.field-label,
.section-title {
  color: #6f3d05;
}

.calc-card > view,
.suggest-item:active {
  background: #fff1d1;
}

.calc-card text {
  color: #9a6b2f;
}

.total-bar {
  border-top-color: #efd7aa;
  background: #fffaf0;
  color: #6f3d05;
}

.total-bar .primary {
  background: #d97817;
}
</style>
