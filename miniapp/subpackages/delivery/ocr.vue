<template>
  <view class="page ocr-page">
    <view class="soft-card shop-card">
      <view class="field-row full">
        <text class="field-label">超市</text>
        <input v-model="marketName" class="input" placeholder="填写超市名称" />
      </view>
    </view>

    <view class="soft-card upload-card">
      <view class="upload-head">
        <view class="section-title">文本识别送货单</view>
        <button class="soft-button primary" :disabled="recognizing" @click="chooseImage">{{ recognizing ? '识别中' : '上传图片识别' }}</button>
      </view>
      <image v-if="imagePath" class="preview-image" :src="imagePath" mode="aspectFill"></image>
      <view v-if="ocrText" class="ocr-text">{{ ocrText }}</view>
    </view>

    <view class="soft-card detail-card">
      <view class="section-title">识别明细</view>
      <view v-for="(item, index) in items" :key="index" class="edit-item">
        <view class="item-head">
          <text>第 {{ index + 1 }} 行</text>
          <button class="mini-delete" @click="items.splice(index, 1)">删</button>
        </view>
        <view class="form-grid">
          <view class="field-row full">
            <text class="field-label">品名</text>
            <input v-model="item.goodsName" class="input" placeholder="水果名称" />
          </view>
          <view class="stock-panel full">
            <view class="stock-switch">
              <button class="stock-button" :class="{ active: item.type === 'purchase' }" @click="markPurchase(item)">代采购</button>
              <button class="stock-button" :class="{ active: item.type === 'own' }" @click="markOwn(item)">本店库存</button>
            </view>
            <template v-if="item.type === 'own'">
              <input
                v-model="item.goodsKeyword"
                class="input stock-input"
                placeholder="搜索并选择库存商品"
                @input="clearSelectedGoods(item)"
              />
              <scroll-view v-if="filteredGoodsForItem(item).length" class="goods-scroll" scroll-y :show-scrollbar="true" enhanced>
                <view class="goods-grid">
                  <view
                    v-for="goods in filteredGoodsForItem(item)"
                    :key="goods.id"
                    class="goods-cell"
                    :class="{ active: item.goodsId === goods.id }"
                    @click="selectGoodsForItem(item, goods)"
                  >
                    <text class="goods-name">{{ goods.name }}</text>
                    <text class="muted">{{ goods.stock }}件 · {{ unitText(goods.unitType) }}</text>
                  </view>
                </view>
              </scroll-view>
              <view v-else class="stock-empty">没有找到库存商品</view>
              <view v-if="item.goodsId" class="stock-tip">已关联库存：{{ item.inventoryName }}，账单仍显示上面的品名。</view>
            </template>
          </view>
          <view class="field-row">
            <text class="field-label">数量</text>
            <input v-model="item.quantity" class="input" type="digit" />
          </view>
          <view class="field-row">
            <text class="field-label">重量</text>
            <input v-model="item.weight" class="input" type="digit" placeholder="可空" />
          </view>
          <view class="field-row">
            <text class="field-label">价格</text>
            <input v-model="item.price" class="input" type="digit" />
          </view>
          <view class="field-row">
            <text class="field-label">佣金</text>
            <input v-model="item.commission" class="input" type="digit" />
          </view>
          <view class="field-row">
            <text class="field-label">成本</text>
            <input v-model="item.costPrice" class="input" type="digit" />
          </view>
        </view>
        <view class="subtotal">小计 ¥{{ money(calcSubtotal(item)) }}</view>
      </view>
      <view v-if="!items.length" class="empty">上传图片后会自动生成明细，也可以手动加一行。</view>
    </view>

    <view class="total-bar">
      <text>合计 ¥{{ money(totalAmount) }}</text>
      <button class="soft-button" @click="addBlankItem">手动加一行</button>
      <button class="soft-button" @click="saveDraft">保存</button>
      <button class="soft-button primary" :disabled="submitting" @click="submitOrder">{{ submitting ? '出单中' : '出单' }}</button>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money } from '../../utils/format'
import { DELIVERY_OCR_DRAFT_KEY } from '../../config/api'

const emptyItem = () => ({
  type: 'purchase',
  goodsId: null,
  goodsName: '',
  goodsKeyword: '',
  inventoryName: '',
  unitType: '',
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
      imagePath: '',
      ocrText: '',
      items: [],
      goodsList: [],
      recognizing: false,
      submitting: false,
      allowLeave: false,
      savedDraftText: ''
    }
  },
  computed: {
    totalAmount() {
      return this.items.reduce((sum, item) => sum + this.calcSubtotal(item), 0)
    }
  },
  onShow() {
    if (requireLogin()) this.loadGoods()
  },
  onLoad() {
    this.restoreDraft()
  },
  onBackPress() {
    if (this.allowLeave || !this.hasUnsavedContent()) return false
    this.confirmLeave()
    return true
  },
  methods: {
    money,
    async loadGoods() {
      this.goodsList = await request({ url: '/api/goods' })
    },
    unitText(unitType) {
      return unitType === 'weight' ? '按重量' : '按件数'
    },
    filteredGoodsForItem(item) {
      const keyword = String(item.goodsKeyword || '').trim()
      if (!keyword) return this.goodsList
      return this.goodsList.filter(goods => goods.name.includes(keyword))
    },
    markOwn(item) {
      item.type = 'own'
      if (!item.goodsKeyword) item.goodsKeyword = item.inventoryName || item.goodsName || ''
    },
    markPurchase(item) {
      item.type = 'purchase'
      item.goodsId = null
      item.goodsKeyword = ''
      item.inventoryName = ''
      item.unitType = ''
    },
    clearSelectedGoods(item) {
      item.goodsId = null
      item.inventoryName = ''
      item.unitType = ''
    },
    selectGoodsForItem(item, goods) {
      item.type = 'own'
      item.goodsId = goods.id
      item.goodsKeyword = goods.name
      item.inventoryName = goods.name
      item.unitType = goods.unitType
      item.price = String(goods.salePrice || goods.costPrice || item.price || 0)
      item.costPrice = String(goods.costPrice || item.costPrice || 0)
      item.commission = String(goods.defaultCommission || item.commission || 0)
    },
    chooseImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const path = res.tempFilePaths[0]
          const tempFile = res.tempFiles?.[0]
          this.imagePath = path
          this.uploadImage(path, tempFile)
        }
      })
    },
    uploadImage(filePath, tempFile) {
      if (this.recognizing) return
      this.recognizing = true
      uni.showLoading({ title: '识别中...' })

      // 微信端使用 base64 走主后端 /api/ocr，避免 uploadFile 在本地和云侧路径不一致。
      // #ifdef MP-WEIXIN
      wx.getFileSystemManager().readFile({
        filePath,
        success: ({ data }) => {
          const imageBase64 = wx.arrayBufferToBase64(data)
          request({
            url: '/api/ocr',
            method: 'POST',
            data: {
              imageBase64,
              filename: 'ocr.jpg'
            },
            timeout: 30000
          }).then((result) => {
            this.applyOcrResult(result)
          }).catch((err) => {
            uni.showToast({ title: err?.message || '识别接口连接失败', icon: 'none' })
          }).finally(() => {
            this.recognizing = false
            uni.hideLoading()
          })
        },
        fail: () => {
          uni.showToast({ title: '图片读取失败', icon: 'none' })
          this.recognizing = false
          uni.hideLoading()
        }
      })
      // #endif

      // #ifdef H5
      this.readH5ImageBase64(filePath, tempFile)
        .then((imageBase64) => this.submitOcr(imageBase64))
        .then((result) => {
          this.applyOcrResult(result)
        })
        .catch((err) => {
          uni.showToast({ title: err?.message || '识别接口连接失败', icon: 'none' })
        })
        .finally(() => {
          this.recognizing = false
          uni.hideLoading()
        })
      // #endif

      // #ifndef MP-WEIXIN
      // #ifndef H5
      const fileManager = uni.getFileSystemManager?.()
      if (!fileManager) {
        uni.showToast({ title: '当前环境不支持读取图片', icon: 'none' })
        this.recognizing = false
        uni.hideLoading()
        return
      }
      fileManager.readFile({
        filePath,
        success: ({ data }) => {
          const imageBase64 = uni.arrayBufferToBase64 ? uni.arrayBufferToBase64(data) : ''
          this.submitOcr(imageBase64).then((result) => {
            this.applyOcrResult(result)
          }).catch((err) => {
            uni.showToast({ title: err?.message || '识别接口连接失败', icon: 'none' })
          }).finally(() => {
            this.recognizing = false
            uni.hideLoading()
          })
        },
        fail: () => {
          uni.showToast({ title: '图片读取失败', icon: 'none' })
          this.recognizing = false
          uni.hideLoading()
        }
      })
      // #endif
      // #endif
    },
    readH5ImageBase64(filePath, tempFile) {
      const file = tempFile?.file || tempFile
      const readBlob = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/, ''))
        reader.onerror = () => reject(new Error('图片读取失败'))
        reader.readAsDataURL(blob)
      })

      if (typeof File !== 'undefined' && file instanceof File) {
        return readBlob(file)
      }

      if (typeof Blob !== 'undefined' && file instanceof Blob) {
        return readBlob(file)
      }

      // H5 的 tempFilePath 常见为 blob: 地址，必须先取回 Blob 后再转 base64。
      return fetch(filePath)
        .then((response) => {
          if (!response.ok) throw new Error('图片读取失败')
          return response.blob()
        })
        .then(readBlob)
    },
    submitOcr(imageBase64) {
      return request({
        url: '/api/ocr',
        method: 'POST',
        data: {
          imageBase64,
          filename: 'ocr.jpg'
        },
        timeout: 30000
      })
    },
    applyOcrResult(rawData) {
      let data = rawData
      if (typeof rawData === 'string') {
        try {
          data = JSON.parse(rawData || '{}')
        } catch (err) {
          uni.showToast({ title: '识别结果解析失败', icon: 'none' })
          return
        }
      }
      if (!data.success) {
        uni.showToast({ title: data.message || '识别失败', icon: 'none' })
        return
      }
      this.ocrText = data.text || ''
      this.items = this.parseOcrTexts(data.texts || this.ocrText.split('\n'))
      uni.showToast({ title: `识别到${this.items.length}行`, icon: 'none' })
    },
    parseOcrTexts(texts) {
      return texts
        .map(text => this.parseLine(text))
        .filter(item => item.goodsName)
    },
    parseLine(rawText) {
      const text = String(rawText || '').replace(/[.。．]/g, '').trim()
      if (!text) return emptyItem()
      const match = text.match(/(.+?)([0-9０-９一二三四五六七八九十百]+)\s*件?$/)
      if (!match) {
        return {
          ...emptyItem(),
          goodsName: text.replace(/件$/, '').trim(),
          quantity: '1'
        }
      }
      return {
        ...emptyItem(),
        goodsName: match[1].trim(),
        quantity: String(this.parseQuantity(match[2]))
      }
    },
    parseQuantity(value) {
      const normalized = String(value || '').replace(/[０-９]/g, char => String(char.charCodeAt(0) - 65296))
      if (/^\d+$/.test(normalized)) return Number(normalized)
      const map = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
      if (normalized === '十') return 10
      const tenMatch = normalized.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/)
      if (tenMatch) return (map[tenMatch[1]] || 1) * 10 + (map[tenMatch[2]] || 0)
      return map[normalized] || 1
    },
    addBlankItem() {
      this.items.push(emptyItem())
    },
    hasDraftContent() {
      return Boolean(this.marketName.trim() || this.ocrText || this.imagePath || this.items.some(item => item.goodsName || item.price || item.costPrice || item.weight))
    },
    draftPayload() {
      return {
        marketName: this.marketName,
        imagePath: this.imagePath,
        ocrText: this.ocrText,
        items: this.items
      }
    },
    draftText() {
      return JSON.stringify(this.draftPayload())
    },
    saveDraft(options = {}) {
      uni.setStorageSync(DELIVERY_OCR_DRAFT_KEY, this.draftPayload())
      this.savedDraftText = this.draftText()
      if (!options.silent) uni.showToast({ title: '已保存草稿', icon: 'success' })
    },
    restoreDraft() {
      const draft = uni.getStorageSync(DELIVERY_OCR_DRAFT_KEY)
      if (!draft) return
      this.marketName = draft.marketName || ''
      this.imagePath = draft.imagePath || ''
      this.ocrText = draft.ocrText || ''
      this.items = Array.isArray(draft.items) ? draft.items.map(item => ({ ...emptyItem(), ...item })) : []
      this.savedDraftText = this.draftText()
    },
    clearDraft() {
      uni.removeStorageSync(DELIVERY_OCR_DRAFT_KEY)
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
    hasUnsavedContent() {
      return this.hasDraftContent() && this.draftText() !== this.savedDraftText
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
    validateOrder() {
      if (!this.marketName.trim()) {
        uni.showToast({ title: '请填写超市名称', icon: 'none' })
        return false
      }
      if (!this.items.length) {
        uni.showToast({ title: '请先识别或添加明细', icon: 'none' })
        return false
      }
      const invalid = this.items.some(item => !item.goodsName.trim() || Number(item.quantity || 0) <= 0 || Number(item.price || 0) <= 0)
      if (invalid) {
        uni.showToast({ title: '品名、数量和价格必须填写', icon: 'none' })
        return false
      }
      const missingStock = this.items.some(item => item.type === 'own' && !item.goodsId)
      if (missingStock) {
        uni.showToast({ title: '本店库存明细必须选择库存商品', icon: 'none' })
        return false
      }
      const missingWeight = this.items.some(item => item.type === 'own' && item.unitType === 'weight' && Number(item.weight || 0) <= 0)
      if (missingWeight) {
        uni.showToast({ title: '按重量库存商品必须填写重量', icon: 'none' })
        return false
      }
      return true
    },
    submitOrder() {
      if (!this.validateOrder()) return
      uni.showModal({
        title: '确认出单',
        content: `超市：${this.marketName.trim()}\n总金额：¥${money(this.totalAmount)}`,
        confirmText: '出单',
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
          url: '/api/supermarket-orders',
          method: 'POST',
          data: {
            supermarketName: this.marketName.trim(),
            items: this.items.map(item => ({
              type: item.type === 'own' ? 'own' : 'purchase',
              goodsId: item.type === 'own' ? item.goodsId : null,
              goodsName: item.goodsName.trim(),
              quantity: Number(item.quantity || 0),
              weight: item.weight === '' ? null : Number(item.weight || 0),
              price: Number(item.price || 0),
              commission: Number(item.commission || 0),
              costPrice: Number(item.costPrice || 0)
            }))
          }
        })
        uni.showToast({ title: '已出单', icon: 'success' })
        this.clearDraft()
        const id = result.id || result.order?.id
        if (id) {
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
.ocr-page {
  padding-bottom: calc(116rpx + var(--window-bottom, 0px) + env(safe-area-inset-bottom));
}

.shop-card,
.upload-card,
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

.upload-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.upload-head .section-title {
  margin-bottom: 0;
}

.upload-head .soft-button {
  width: 220rpx;
  flex: 0 0 220rpx;
}

.preview-image {
  width: 100%;
  height: 260rpx;
  margin-top: 14rpx;
  border-radius: 16rpx;
  background: #edf2eb;
}

.ocr-text {
  max-height: 180rpx;
  margin-top: 14rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f7fbf3;
  color: #415149;
  font-size: 23rpx;
  line-height: 1.5;
  overflow: auto;
  white-space: pre-wrap;
}

.edit-item {
  margin-bottom: 16rpx;
  padding: 14rpx;
  border: 2rpx solid #c9dcc9;
  border-radius: 16rpx;
  background: #fffef9;
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.form-grid .full {
  grid-column: 1 / -1;
}

.form-grid .input {
  min-width: 0;
  padding: 0 14rpx;
}

.stock-panel {
  padding: 12rpx;
  border: 1rpx solid #dfe8d8;
  border-radius: 14rpx;
  background: #f8fbf4;
}

.stock-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10rpx;
}

.stock-button {
  height: 58rpx;
  min-height: 58rpx;
  border-radius: 12rpx;
  background: #edf2eb;
  color: #718078;
  font-size: 24rpx;
  font-weight: 900;
}

.stock-button.active {
  background: #16945f;
  color: #ffffff;
}

.stock-input {
  margin-top: 12rpx;
}

.goods-scroll {
  max-height: 252rpx;
  margin-top: 12rpx;
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
}

.goods-cell {
  min-height: 88rpx;
  padding: 12rpx;
  border: 1rpx solid #dfe8d8;
  border-radius: 12rpx;
  background: #fffef9;
}

.goods-cell.active {
  border-color: #16945f;
  background: #e8f6ed;
}

.goods-name {
  display: block;
  overflow: hidden;
  color: #17362f;
  font-size: 24rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted,
.stock-tip,
.stock-empty {
  color: #718078;
  font-size: 22rpx;
}

.stock-tip,
.stock-empty {
  margin-top: 10rpx;
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

.subtotal {
  margin-top: 12rpx;
  color: #16945f;
  font-size: 28rpx;
  font-weight: 900;
  text-align: right;
}

.empty {
  padding: 40rpx 0;
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
  grid-template-columns: minmax(0, 1fr) 176rpx 132rpx 132rpx;
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
</style>
