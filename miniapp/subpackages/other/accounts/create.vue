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

      <view class="field-row full inline-top">
        <text class="field-label">时间</text>
        <picker :value="timeModeIndex" :range="timeModeOptions" range-key="label" @change="changeTimeMode">
          <view class="input picker-input">{{ timeModeOptions[timeModeIndex].label }}</view>
        </picker>
      </view>

      <view v-if="form.timeMode === 'custom'" class="time-grid">
        <view class="field-row">
          <text class="field-label">日期</text>
          <picker mode="date" :value="form.createdDate" @change="changeCreatedDate">
            <view class="input picker-input">{{ form.createdDate || '选择日期' }}</view>
          </picker>
        </view>
        <view class="field-row">
          <text class="field-label">时间</text>
          <picker mode="time" :value="form.createdTime" @change="changeCreatedTime">
            <view class="input picker-input">{{ form.createdTime || '选择时间' }}</view>
          </picker>
        </view>
      </view>
    </view>

    <view class="soft-card form-card">
      <view class="section-title">入账</view>

      <view class="mode-switch">
        <view
          class="mode-item"
          :class="{ active: form.calcMode === 'auto_amount' }"
          @click="setCalcMode('auto_amount')"
        >
          总金额去计算成本
        </view>
        <view
          class="mode-item"
          :class="{ active: form.calcMode === 'direct_cost' }"
          @click="setCalcMode('direct_cost')"
        >
          直接写成本
        </view>
      </view>

      <view class="form-list">
        <view class="field-block">
          <text class="field-label block">品名</text>
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

        <view class="field-block">
          <text class="field-label block">计价方式</text>
          <picker :value="unitIndex" :range="unitOptions" range-key="label" @change="changeUnit">
            <view class="input picker-input">{{ unitOptions[unitIndex].label }}</view>
          </picker>
        </view>

        <view class="field-block">
          <text class="field-label block">入库状态</text>
          <picker :value="stockIndex" :range="stockOptions" range-key="label" @change="changeStockMode">
            <view class="input picker-input">{{ stockOptions[stockIndex].label }}</view>
          </picker>
        </view>

        <view class="field-block">
          <text class="field-label block">数量</text>
          <input v-model="form.quantity" class="input" type="digit" placeholder="填写数量/件" />
        </view>

        <view v-if="form.unitType === 'weight'" class="field-block">
          <text class="field-label block">重量</text>
          <input v-model="form.weight" class="input" type="digit" placeholder="填写总重量/斤" />
        </view>

        <view class="field-block" v-if="form.calcMode === 'auto_amount'">
          <text class="field-label block">总金额</text>
          <input v-model="form.totalAmount" class="input" type="digit" placeholder="填写总金额" />
        </view>

        <view class="field-block" v-else>
          <text class="field-label block">成本</text>
          <input v-model="form.costInput" class="input" type="digit" :placeholder="form.unitType === 'weight' ? '填写每斤成本' : '填写每件成本'" />
        </view>

        <view class="field-block">
          <text class="field-label block">成本佣金/件</text>
          <input v-model="form.commissionInput" class="input" type="digit" placeholder="可空，填写每件佣金" />
        </view>

        <view class="field-block">
          <text class="field-label block">售价</text>
          <input v-model="form.salePrice" class="input" type="digit" placeholder="填写售价" />
        </view>

        <view class="field-block">
          <text class="field-label block">售卖佣金/件</text>
          <input v-model="form.saleCommission" class="input" type="digit" placeholder="可空，售卖时每件佣金" />
        </view>
      </view>

      <view class="calc-card">
        <view>
          <text>{{ form.calcMode === 'auto_amount' ? '自动成本' : '成本预览' }}</text>
          <view>¥{{ money(costPrice) }}{{ form.unitType === 'weight' ? '/斤' : '/件' }}</view>
        </view>
        <view>
          <text>成本佣金/件</text>
          <view>¥{{ money(commission) }}</view>
        </view>
      </view>
    </view>

    <view class="total-bar">
      <text>合计 ¥{{ money(summaryAmount) }}</text>
      <button class="soft-button primary" :disabled="submitting" @click="submitEntry">{{ submitting ? '保存中' : '保存入账' }}</button>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { money } from '../../../utils/format'

const todayText = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const timeText = () => {
  const now = new Date()
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

const emptyForm = () => ({
  goodsName: '',
  unitType: 'weight',
  stockMode: 'auto_stocked',
  calcMode: 'direct_cost',
  quantity: '',
  weight: '',
  totalAmount: '',
  costInput: '',
  commissionInput: '',
  salePrice: '',
  saleCommission: '',
  timeMode: 'now',
  createdDate: todayText(),
  createdTime: timeText()
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
      ],
      timeModeOptions: [
        { label: '现在', value: 'now' },
        { label: '选择时间', value: 'custom' }
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
    timeModeIndex() {
      return this.form.timeMode === 'custom' ? 1 : 0
    },
    quantityValue() {
      return Number(this.form.quantity || 0)
    },
    weightValue() {
      return Number(this.form.weight || 0)
    },
    commission() {
      const commission = Number(this.form.commissionInput || 0)
      return commission > 0 ? Number(commission.toFixed(2)) : 0
    },
    billingAmount() {
      return this.form.unitType === 'weight' ? this.weightValue : this.quantityValue
    },
    totalCommissionValue() {
      return Number((this.commission * this.quantityValue).toFixed(2))
    },
    directCostTotal() {
      return Number((Number(this.form.costInput || 0) * this.billingAmount).toFixed(2))
    },
    costPrice() {
      const baseCost = this.form.calcMode === 'auto_amount'
        ? Math.max(Number(this.form.totalAmount || 0) - this.totalCommissionValue, 0)
        : this.directCostTotal
      return this.billingAmount > 0 ? Number((baseCost / this.billingAmount).toFixed(2)) : 0
    },
    summaryAmount() {
      if (this.form.calcMode === 'auto_amount') return Number(this.form.totalAmount || 0)
      return Number((this.directCostTotal + this.totalCommissionValue).toFixed(2))
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
    setCalcMode(mode) {
      this.form.calcMode = mode
      if (mode === 'direct_cost') {
        this.form.totalAmount = ''
      } else {
        this.form.costInput = ''
      }
    },
    changeTimeMode(event) {
      this.form.timeMode = this.timeModeOptions[Number(event.detail.value)].value
      if (this.form.timeMode === 'now') {
        this.form.createdDate = todayText()
        this.form.createdTime = timeText()
      }
    },
    changeCreatedDate(event) {
      this.form.createdDate = event.detail.value
    },
    changeCreatedTime(event) {
      this.form.createdTime = event.detail.value
    },
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
      if (!this.form.saleCommission) this.form.saleCommission = String(goods.saleCommission || 0)
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
      if (this.form.calcMode === 'auto_amount') {
        if (Number(this.form.totalAmount || 0) <= 0) {
          uni.showToast({ title: '请填写总金额', icon: 'none' })
          return false
        }
      } else if (Number(this.form.costInput || 0) <= 0) {
        uni.showToast({ title: '请填写成本', icon: 'none' })
        return false
      }
      if (Number(this.form.commissionInput || 0) < 0) {
        uni.showToast({ title: '佣金不能小于0', icon: 'none' })
        return false
      }
      if (this.form.calcMode === 'auto_amount' && this.totalCommissionValue > Number(this.form.totalAmount || 0)) {
        uni.showToast({ title: '佣金不能大于总金额', icon: 'none' })
        return false
      }
      if (Number(this.form.salePrice || 0) <= 0) {
        uni.showToast({ title: '请填写售价', icon: 'none' })
        return false
      }
      return true
    },
    submitEntry() {
      if (!this.validateForm()) return
      const modeText = this.form.calcMode === 'auto_amount' ? '总金额去计算成本' : '直接写成本'
      const stockText = this.form.stockMode === 'auto_stocked' ? '未入库，将自动入库' : '已入库，只记录'
      const timeText = this.form.timeMode === 'now'
        ? '入账时间：现在'
        : `入账时间：${this.form.createdDate} ${this.form.createdTime}`
      const amountText = this.form.calcMode === 'auto_amount'
        ? `总金额：¥${money(this.form.totalAmount)}`
        : `成本：¥${money(this.form.costInput)}${this.form.unitType === 'weight' ? '/斤' : '/件'}`
      uni.showModal({
        title: '确认入账',
        content: `货主：${this.supplierName.trim()}\n${timeText}\n品名：${this.form.goodsName.trim()}\n计价方式：${this.unitOptions[this.unitIndex].label}\n入库状态：${stockText}\n数量：${this.form.quantity}\n${this.form.unitType === 'weight' ? `重量：${this.form.weight}斤\n` : ''}${amountText}\n成本佣金/件：¥${money(this.commission)}\n售卖佣金/件：¥${money(this.form.saleCommission || 0)}\n售价：¥${money(this.form.salePrice)}\n模式：${modeText}`,
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
        const payload = {
          supplierName: this.supplierName.trim(),
          goodsName: this.form.goodsName.trim(),
          unitType: this.form.unitType,
          stockMode: this.form.stockMode,
          quantity: Number(this.form.quantity || 0),
          weight: this.form.unitType === 'weight' ? Number(this.form.weight || 0) : null,
          totalAmount: this.form.calcMode === 'auto_amount'
            ? Number(this.form.totalAmount || 0)
            : this.summaryAmount,
          totalCommission: this.totalCommissionValue,
          saleCommission: Number(this.form.saleCommission || 0),
          salePrice: Number(this.form.salePrice || 0)
        }
        if (this.form.timeMode === 'custom') {
          payload.createdDate = this.form.createdDate
          payload.createdTime = this.form.createdTime
        }
        const result = await request({
          url: '/api/supplier-entries',
          method: 'POST',
          data: payload
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
  min-height: 100vh;
  padding-bottom: calc(116rpx + var(--window-bottom, 0px) + env(safe-area-inset-bottom));
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

.field-row.full {
  position: relative;
}

.field-row.inline-top {
  margin-top: 14rpx;
  align-items: start;
}

.field-block {
  position: relative;
}

.field-label {
  color: #6f3d05;
  font-size: 24rpx;
  font-weight: 900;
  text-align: right;
}

.field-label.block {
  display: block;
  margin-bottom: 10rpx;
  text-align: left;
}

.section-title {
  margin-bottom: 14rpx;
  color: #6f3d05;
  font-size: 30rpx;
  font-weight: 900;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.mode-item {
  min-height: 66rpx;
  padding: 16rpx;
  border: 1rpx solid #efd7aa;
  border-radius: 14rpx;
  background: #fffaf0;
  color: #9a6b2f;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
  line-height: 1.3;
}

.mode-item.active {
  background: #d97817;
  color: #ffffff;
  border-color: #d97817;
}

.form-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.time-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.input,
.picker-input {
  height: 68rpx;
  padding: 0 18rpx;
  border: 1rpx solid #efd7aa;
  border-radius: 14rpx;
  background: #fffaf0;
  color: #17362f;
  font-size: 26rpx;
}

.picker-input {
  display: flex;
  align-items: center;
}

.suggest-float {
  position: absolute;
  left: 0;
  right: 0;
  top: 88rpx;
  z-index: 99;
  max-height: 188rpx;
  border: 1rpx solid #dce5dc;
  border-radius: 12rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(24, 37, 46, 0.14);
  overflow: hidden;
}

.goods-suggest-float {
  top: 96rpx;
}

.suggest-item {
  min-height: 56rpx;
  padding: 14rpx 18rpx;
  border-bottom: 1rpx solid #eef2ee;
  font-weight: 800;
}

.suggest-item:active {
  background: #fff1d1;
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
  background: #fff1d1;
}

.calc-card text {
  color: #9a6b2f;
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
  border-top: 1rpx solid #efd7aa;
  background: #fffaf0;
  box-shadow: 0 -8rpx 22rpx rgba(25, 55, 44, 0.1);
  color: #6f3d05;
  font-size: 32rpx;
  font-weight: 900;
}

.total-bar .primary {
  background: #d97817;
}
</style>
