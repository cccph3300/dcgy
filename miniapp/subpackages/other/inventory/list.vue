<template>
  <view class="page inventory-page">
    <view class="soft-card toolbar">
      <input v-model="keyword" class="input" placeholder="搜索货物" @input="reloadFirstPage" />
      <button class="soft-button primary" @click="startCreate">货物入库</button>
      <button class="soft-button import-button" @click="startImport">导入货物</button>
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
        <view class="field-block full-span">
          <text class="field-label block">水果名称</text>
          <input
            v-model.trim="form.name"
            class="input"
            placeholder="水果名称"
            @input="onEditNameInput"
            @focus="searchEditGoods"
          />
          <scroll-view v-if="formNameSuggestions.length" class="suggest-float" scroll-y enhanced>
            <view
              v-for="goods in formNameSuggestions"
              :key="goods.id"
              class="suggest-item"
              @click="selectFormGoods(goods)"
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
          <text class="field-label block">库存数量/件</text>
          <input v-model="form.stock" class="input" type="digit" placeholder="填写件数" />
        </view>
        <view class="field-block">
          <text class="field-label block">成本价</text>
          <input v-model="form.costPrice" class="input" type="digit" :placeholder="form.unitType === 'weight' ? '每斤成本' : '每件成本'" />
        </view>
        <view class="field-block">
          <text class="field-label block">售卖价</text>
          <input v-model="form.salePrice" class="input" type="digit" :placeholder="form.unitType === 'weight' ? '每斤售价' : '每件售价'" />
        </view>
        <view class="field-block">
          <text class="field-label block">成本佣金/件</text>
          <input v-model="form.defaultCommission" class="input" type="digit" placeholder="拿货时每件佣金" />
        </view>
        <view class="field-block">
          <text class="field-label block">售卖佣金/件</text>
          <input v-model="form.saleCommission" class="input" type="digit" placeholder="售卖时每件佣金" />
        </view>
      </view>
      <view class="button-row">
        <button class="soft-button" @click="editing = false">取消</button>
        <button class="soft-button primary" @click="saveGoods">保存</button>
      </view>
    </view>

    <view v-if="importing" class="soft-card import-panel">
      <view class="section-title">导入货物</view>
      <view class="import-tip">按整批金额自动平均成本和佣金，保存前可再填写售卖价。</view>
      <view class="form-grid">
        <view class="field-block full-span">
          <text class="field-label block">水果名称</text>
          <input
            v-model.trim="importForm.name"
            class="input"
            placeholder="水果名称"
            @input="onImportNameInput"
            @focus="searchImportGoods"
          />
          <scroll-view v-if="importNameSuggestions.length" class="suggest-float" scroll-y enhanced>
            <view
              v-for="goods in importNameSuggestions"
              :key="goods.id"
              class="suggest-item"
              @click="selectImportGoods(goods)"
            >
              {{ goods.name }}
            </view>
          </scroll-view>
        </view>
        <view class="field-block">
          <text class="field-label block">计价方式</text>
          <picker :value="importUnitIndex" :range="unitOptions" range-key="label" @change="changeImportUnit">
            <view class="input picker-input">{{ unitOptions[importUnitIndex].label }}</view>
          </picker>
        </view>
        <view class="field-block">
          <text class="field-label block">件数</text>
          <input v-model="importForm.pieces" class="input" type="digit" placeholder="填写件数" />
        </view>
        <view v-if="importForm.unitType === 'weight'" class="field-block">
          <text class="field-label block">总重量/斤</text>
          <input v-model="importForm.weight" class="input" type="digit" placeholder="填写总重量" />
        </view>
        <view class="field-block">
          <text class="field-label block">拿货总金额</text>
          <input v-model="importForm.totalAmount" class="input" type="digit" placeholder="整批总金额" />
        </view>
        <view class="field-block">
          <text class="field-label block">拿货总佣金</text>
          <input v-model="importForm.totalCommission" class="input" type="digit" placeholder="可空" />
        </view>
        <view class="field-block">
          <text class="field-label block">售卖价</text>
          <input v-model="importForm.salePrice" class="input" type="digit" :placeholder="importForm.unitType === 'weight' ? '每斤售价' : '每件售价'" />
        </view>
        <view class="field-block">
          <text class="field-label block">售卖佣金/件</text>
          <input v-model="importForm.saleCommission" class="input" type="digit" placeholder="可空" />
        </view>
      </view>
      <view class="calc-card">
        <view>
          <text>自动成本</text>
          <view>¥{{ money(importCostPrice) }}{{ importForm.unitType === 'weight' ? '/斤' : '/件' }}</view>
        </view>
        <view>
          <text>成本佣金/件</text>
          <view>¥{{ money(importCommission) }}</view>
        </view>
      </view>
      <view class="button-row">
        <button class="soft-button" @click="importing = false">取消</button>
        <button class="soft-button primary" @click="saveImportGoods">导入</button>
      </view>
    </view>

    <view class="soft-card inventory-card">
      <view class="inventory-head">
        <view class="section-title">库存列表</view>
        <button class="soft-button warn-button clean-button" @click="previewZeroStock">清理库存</button>
      </view>
      <scroll-view v-if="filteredGoods.length" class="inventory-scroll" scroll-y :show-scrollbar="true" enhanced>
        <view v-for="goods in filteredGoods" :key="goods.id" class="inventory-row">
          <view class="inventory-main">
            <text class="goods-name">{{ goods.name }}</text>
            <text class="muted">{{ numberText(goods.stock) }}件 · 售¥{{ money(goods.salePrice) }} · 售佣¥{{ money(goods.saleCommission || 0) }}</text>
          </view>
          <view class="actions">
            <button class="mini-button" @click="startEdit(goods)">编辑</button>
            <button class="mini-button danger" @click="deleteGoods(goods)">删除</button>
          </view>
        </view>
      </scroll-view>
      <view v-if="!filteredGoods.length" class="empty">没有库存</view>
      <view class="pager">
        <button class="pager-button" :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
        <text>{{ page }} / {{ totalPages }}</text>
        <button class="pager-button" :disabled="page >= totalPages" @click="changePage(page + 1)">下一页</button>
      </view>
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
  defaultCommission: '',
  saleCommission: ''
})

const emptyImportForm = () => ({
  name: '',
  unitType: 'weight',
  pieces: '',
  weight: '',
  totalAmount: '',
  totalCommission: '',
  salePrice: '',
  saleCommission: ''
})

export default {
  data() {
    return {
      keyword: '',
      goodsList: [],
      page: 1,
      pageSize: 10,
      totalPages: 1,
      searchTimer: null,
      zeroPanel: false,
      zeroGoods: [],
      editing: false,
      importing: false,
      formNameSuggestions: [],
      importNameSuggestions: [],
      formSearchTimer: null,
      importSearchTimer: null,
      form: emptyForm(),
      importForm: emptyImportForm(),
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
    importUnitIndex() {
      return this.importForm.unitType === 'qty' ? 1 : 0
    },
    importCommission() {
      const pieces = Number(this.importForm.pieces || 0)
      const totalCommission = Number(this.importForm.totalCommission || 0)
      if (pieces <= 0 || totalCommission <= 0) return 0
      return Number((totalCommission / pieces).toFixed(2))
    },
    importCostPrice() {
      const totalAmount = Number(this.importForm.totalAmount || 0)
      const totalCommission = Number(this.importForm.totalCommission || 0)
      const costTotal = Math.max(totalAmount - totalCommission, 0)
      if (this.importForm.unitType === 'weight') {
        const weight = Number(this.importForm.weight || 0)
        return weight > 0 ? Number((costTotal / weight).toFixed(2)) : 0
      }
      const pieces = Number(this.importForm.pieces || 0)
      return pieces > 0 ? Number((costTotal / pieces).toFixed(2)) : 0
    },
    filteredGoods() {
      return this.goodsList
    }
  },
  onShow() {
    if (requireLogin()) this.loadGoods()
  },
  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    if (this.formSearchTimer) clearTimeout(this.formSearchTimer)
    if (this.importSearchTimer) clearTimeout(this.importSearchTimer)
  },
  methods: {
    money,
    numberText,
    clearFormSuggestions() {
      this.formNameSuggestions = []
    },
    clearImportSuggestions() {
      this.importNameSuggestions = []
    },
    onEditNameInput() {
      if (this.formSearchTimer) clearTimeout(this.formSearchTimer)
      this.formSearchTimer = setTimeout(() => this.searchEditGoods(), 220)
    },
    onImportNameInput() {
      if (this.importSearchTimer) clearTimeout(this.importSearchTimer)
      this.importSearchTimer = setTimeout(() => this.searchImportGoods(), 220)
    },
    async searchGoodsByKeyword(keyword) {
      const result = await request({ url: `/api/goods?q=${encodeURIComponent(keyword)}&page=1&pageSize=8` })
      return Array.isArray(result) ? result : (result?.items || [])
    },
    async searchEditGoods() {
      const keyword = this.form.name.trim()
      if (!keyword) {
        this.formNameSuggestions = []
        return
      }
      this.formNameSuggestions = await this.searchGoodsByKeyword(keyword)
    },
    async searchImportGoods() {
      const keyword = this.importForm.name.trim()
      if (!keyword) {
        this.importNameSuggestions = []
        return
      }
      this.importNameSuggestions = await this.searchGoodsByKeyword(keyword)
    },
    selectFormGoods(goods) {
      const editingExisting = Boolean(this.form.id)
      this.form = {
        id: editingExisting ? goods.id : null,
        name: goods.name,
        unitType: goods.unitType,
        stock: editingExisting ? goods.stock : '',
        costPrice: goods.costPrice,
        salePrice: goods.salePrice,
        defaultCommission: goods.defaultCommission,
        saleCommission: goods.saleCommission || 0
      }
      this.formNameSuggestions = []
    },
    selectImportGoods(goods) {
      this.importForm.name = goods.name
      this.importForm.unitType = goods.unitType === 'qty' ? 'qty' : 'weight'
      if (this.importForm.unitType === 'qty') this.importForm.weight = ''
      if (!this.importForm.salePrice) this.importForm.salePrice = String(goods.salePrice || '')
      this.importNameSuggestions = []
    },
    reloadFirstPage() {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.page = 1
        this.loadGoods()
      }, 220)
    },
    changePage(page) {
      this.page = page
      this.loadGoods()
    },
    async loadGoods() {
      const params = [
        `page=${this.page}`,
        `pageSize=${this.pageSize}`
      ]
      const keyword = this.keyword.trim()
      if (keyword) params.push(`q=${encodeURIComponent(keyword)}`)
      const result = await request({ url: `/api/goods?${params.join('&')}` })
      this.goodsList = result.items || []
      this.totalPages = result.totalPages || 1
      if (this.page > this.totalPages) {
        this.page = this.totalPages
        await this.loadGoods()
      }
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
    changeImportUnit(event) {
      this.importForm.unitType = this.unitOptions[Number(event.detail.value)].value
      if (this.importForm.unitType === 'qty') this.importForm.weight = ''
    },
    startCreate() {
      this.form = emptyForm()
      this.editing = true
      this.importing = false
      this.clearImportSuggestions()
      this.clearFormSuggestions()
    },
    startImport() {
      this.importForm = emptyImportForm()
      this.importing = true
      this.editing = false
      this.clearFormSuggestions()
      this.clearImportSuggestions()
    },
    startEdit(goods) {
      this.form = {
        id: goods.id,
        name: goods.name,
        unitType: goods.unitType,
        stock: goods.stock,
        costPrice: goods.costPrice,
        salePrice: goods.salePrice,
        defaultCommission: goods.defaultCommission,
        saleCommission: goods.saleCommission || 0
      }
      this.editing = true
      this.importing = false
      this.clearImportSuggestions()
    },
    async saveImportGoods() {
      const name = this.importForm.name.trim()
      const pieces = Number(this.importForm.pieces || 0)
      const totalAmount = Number(this.importForm.totalAmount || 0)
      const salePrice = Number(this.importForm.salePrice || 0)
      if (!name) {
        uni.showToast({ title: '请填写水果名称', icon: 'none' })
        return
      }
      if (pieces <= 0) {
        uni.showToast({ title: '请填写件数', icon: 'none' })
        return
      }
      if (this.importForm.unitType === 'weight' && Number(this.importForm.weight || 0) <= 0) {
        uni.showToast({ title: '请填写总重量', icon: 'none' })
        return
      }
      if (totalAmount <= 0) {
        uni.showToast({ title: '请填写总金额', icon: 'none' })
        return
      }
      if (Number(this.importForm.totalCommission || 0) > totalAmount) {
        uni.showToast({ title: '总佣金不能大于总金额', icon: 'none' })
        return
      }
      if (salePrice <= 0) {
        uni.showToast({ title: '请填写售卖价', icon: 'none' })
        return
      }
      await request({
        url: '/api/goods',
        method: 'POST',
        data: {
          name,
          unitType: this.importForm.unitType,
          stock: pieces,
          costPrice: this.importCostPrice,
          salePrice,
          defaultCommission: this.importCommission,
          saleCommission: Number(this.importForm.saleCommission || 0)
        }
      })
      uni.showToast({ title: '已导入', icon: 'success' })
      this.importing = false
      this.clearImportSuggestions()
      this.page = 1
      await this.loadGoods()
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
        defaultCommission: Number(this.form.defaultCommission || 0),
        saleCommission: Number(this.form.saleCommission || 0)
      }
      if (this.form.id) {
        await request({ url: `/api/goods/${this.form.id}`, method: 'PATCH', data })
      } else {
        await request({ url: '/api/goods', method: 'POST', data })
      }
      this.editing = false
      this.clearFormSuggestions()
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

.import-button {
  background: #fff6cf;
  color: #17362f;
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

.field-block {
  position: relative;
  min-width: 0;
}

.field-label.block {
  display: block;
  margin-bottom: 8rpx;
  color: #17362f;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 1.2;
}

.full-span {
  grid-column: 1 / -1;
}

.suggest-float {
  position: absolute;
  left: 0;
  right: 0;
  top: 108rpx;
  z-index: 99;
  max-height: 220rpx;
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
  color: #17362f;
  font-weight: 800;
}

.suggest-item:active {
  background: #fff1d1;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx 12rpx;
  margin-bottom: 16rpx;
}

.form-grid .input,
.form-grid .picker-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 66rpx;
  padding: 0 16rpx;
  font-size: 25rpx;
}

.import-panel {
  border-color: #f3dfac;
  background: #fffdf6;
}

.import-tip {
  margin: 8rpx 0 16rpx;
  color: #718078;
  font-size: 24rpx;
  line-height: 1.45;
}

.calc-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 4rpx;
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

.button-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 16rpx;
}

.inventory-card {
  margin-bottom: 0;
}

.inventory-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.inventory-head .section-title {
  margin-bottom: 0;
}

.inventory-scroll {
  max-height: calc(100vh - 260rpx);
}

.pager {
  display: grid;
  grid-template-columns: 150rpx minmax(0, 1fr) 150rpx;
  gap: 16rpx;
  align-items: center;
  padding: 12rpx 0 0;
  color: #17362f;
  font-weight: 900;
  text-align: center;
}

.pager-button {
  height: 58rpx;
  min-height: 58rpx;
  border-radius: 16rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
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
