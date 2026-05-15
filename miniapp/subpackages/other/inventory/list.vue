<template>
  <view class="page inventory-page">
    <view class="soft-card toolbar">
      <input v-model="keyword" class="input" placeholder="搜索货物" />
      <button class="soft-button primary" @click="startCreate">货物入库</button>
      <button class="soft-button warn-button clean-button" @click="previewZeroStock">清理库存</button>
    </view>

    <view v-if="zeroPanel" class="soft-card zero-panel">
      <view class="section-title">库存为 0 的货物</view>
      <view v-for="goods in zeroGoods" :key="goods.id" class="zero-item">
        {{ goods.name }}
      </view>
      <view v-if="!zeroGoods.length" class="empty">没有库存为 0 的货物</view>
      <view v-if="zeroGoods.length" class="button-row">
        <button class="soft-button" @click="zeroPanel = false">取消</button>
        <button class="soft-button warn-button" @click="confirmCleanZero">确认清理</button>
      </view>
    </view>

    <view v-if="editing" class="soft-card edit-panel">
      <view class="section-title">{{ form.id ? '编辑货物' : '货物入库' }}</view>
      <view class="form-grid">
        <input v-model="form.name" class="input" placeholder="水果名称" />
        <picker :value="unitIndex" :range="unitOptions" range-key="label" @change="changeUnit">
          <view class="input picker-input">{{ unitOptions[unitIndex].label }}</view>
        </picker>
        <input v-model="form.stock" class="input" type="digit" placeholder="数量/件" />
        <input v-model="form.costPrice" class="input" type="digit" placeholder="成本价" />
        <input v-model="form.salePrice" class="input" type="digit" placeholder="售卖价" />
        <input v-model="form.defaultCommission" class="input" type="digit" placeholder="佣金 可不填" />
      </view>
      <view class="button-row">
        <button class="soft-button" @click="editing = false">取消</button>
        <button class="soft-button primary" @click="saveGoods">保存</button>
      </view>
    </view>

    <view class="soft-card inventory-card">
      <view class="section-title">库存列表</view>
      <scroll-view v-if="filteredGoods.length" class="inventory-scroll" scroll-y :show-scrollbar="true" enhanced>
        <view v-for="goods in filteredGoods" :key="goods.id" class="inventory-row">
          <view class="inventory-main">
            <text class="goods-name">{{ goods.name }}</text>
            <text class="muted">{{ numberText(goods.stock) }}件 · 售¥{{ money(goods.salePrice) }} · 佣¥{{ money(goods.defaultCommission) }}</text>
          </view>
          <view class="actions">
            <button class="mini-button" @click="startEdit(goods)">编辑</button>
            <button class="mini-button danger" @click="deleteGoods(goods)">删除</button>
          </view>
        </view>
      </scroll-view>
      <view v-if="!filteredGoods.length" class="empty">没有库存</view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { money, numberText } from '../../../utils/format'

const emptyForm = () => ({
  id: null,
  name: '',
  unitType: 'weight',
  stock: '',
  costPrice: '',
  salePrice: '',
  defaultCommission: ''
})

export default {
  data() {
    return {
      keyword: '',
      goodsList: [],
      zeroPanel: false,
      zeroGoods: [],
      editing: false,
      form: emptyForm(),
      unitOptions: [
        { label: '按重量计价', value: 'weight' },
        { label: '按件数计价', value: 'qty' }
      ]
    }
  },
  computed: {
    unitIndex() {
      return this.form.unitType === 'qty' ? 1 : 0
    },
    filteredGoods() {
      const text = this.keyword.trim()
      if (!text) return this.goodsList
      return this.goodsList.filter(item => item.name.includes(text))
    }
  },
  onShow() {
    if (requireLogin()) this.loadGoods()
  },
  methods: {
    money,
    numberText,
    async loadGoods() {
      this.goodsList = await request({ url: '/api/goods' })
    },
    async previewZeroStock() {
      this.zeroGoods = await request({ url: '/api/goods/zero-stock' })
      this.zeroPanel = true
    },
    confirmCleanZero() {
      uni.showModal({
        title: '确认清理？',
        content: `将隐藏 ${this.zeroGoods.length} 个库存为0的货物`,
        success: async (res) => {
          if (!res.confirm) return
          const result = await request({ url: '/api/goods/zero-stock', method: 'POST' })
          uni.showToast({ title: `已清理${result.count}个`, icon: 'none' })
          this.zeroPanel = false
          this.zeroGoods = []
          await this.loadGoods()
        }
      })
    },
    changeUnit(event) {
      this.form.unitType = this.unitOptions[Number(event.detail.value)].value
    },
    startCreate() {
      this.form = emptyForm()
      this.editing = true
    },
    startEdit(goods) {
      this.form = {
        id: goods.id,
        name: goods.name,
        unitType: goods.unitType,
        stock: goods.stock,
        costPrice: goods.costPrice,
        salePrice: goods.salePrice,
        defaultCommission: goods.defaultCommission
      }
      this.editing = true
    },
    async saveGoods() {
      if (!this.form.name.trim()) {
        uni.showToast({ title: '请填写水果名称', icon: 'none' })
        return
      }
      const data = {
        name: this.form.name.trim(),
        unitType: this.form.unitType,
        stock: Number(this.form.stock || 0),
        costPrice: Number(this.form.costPrice || 0),
        salePrice: Number(this.form.salePrice || 0),
        defaultCommission: Number(this.form.defaultCommission || 0)
      }
      if (this.form.id) {
        await request({ url: `/api/goods/${this.form.id}`, method: 'PATCH', data })
      } else {
        await request({ url: '/api/goods', method: 'POST', data })
      }
      this.editing = false
      await this.loadGoods()
    },
    deleteGoods(goods) {
      uni.showModal({
        title: `删除${goods.name}？`,
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/goods/${goods.id}`, method: 'DELETE' })
          this.loadGoods()
        }
      })
    }
  }
}
</script>

<style scoped>
.inventory-page {
  padding-bottom: calc(18rpx + env(safe-area-inset-bottom));
}

.clean-button {
  width: 150rpx;
  height: 58rpx;
  min-height: 58rpx;
  font-size: 24rpx;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150rpx 150rpx;
  gap: 10rpx;
  align-items: center;
  padding: 16rpx;
}

.toolbar .soft-button {
  width: 150rpx;
  height: 68rpx;
  min-height: 68rpx;
  padding: 0 8rpx;
  font-size: 24rpx;
}

.warn-button {
  background: #ff6f61;
  color: #ffffff;
}

.zero-panel {
  border-color: #ffd8d1;
  background: #fffdf9;
}

.zero-item {
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eef2ee;
  font-weight: 800;
}

.picker-input {
  display: flex;
  align-items: center;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.button-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 16rpx;
}

.inventory-card {
  margin-bottom: 0;
}

.inventory-scroll {
  max-height: calc(100vh - 260rpx);
}

.inventory-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10rpx;
  align-items: center;
  min-height: 78rpx;
  margin-bottom: 10rpx;
  padding: 12rpx 12rpx 12rpx 48rpx;
  position: relative;
  border: 1rpx solid #dfe8d8;
  border-radius: 14rpx;
  background: #fffef9;
  box-shadow: 0 6rpx 14rpx rgba(25, 55, 44, 0.04);
}

.inventory-row::before {
  position: absolute;
  left: 16rpx;
  top: 28rpx;
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: #ffbf3f;
  box-shadow: 8rpx -7rpx 0 #d9f5e6;
  content: "";
}

.inventory-main {
  min-width: 0;
}

.goods-name {
  display: block;
  overflow: hidden;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.mini-button {
  min-width: 88rpx;
  height: 58rpx;
  min-height: 58rpx;
  padding: 0 16rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 26rpx;
  font-weight: 900;
}

.mini-button.danger {
  min-width: 72rpx;
  height: 50rpx;
  min-height: 50rpx;
  padding: 0 12rpx;
  background: #ffe3df;
  color: #e85d4f;
  font-size: 24rpx;
}

.empty {
  padding: 40rpx 0;
  color: #6b7780;
  text-align: center;
}
</style>
