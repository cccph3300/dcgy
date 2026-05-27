<template>
  <view class="page retail-upload">
    <view class="head">
      <view>
        <view class="eyebrow">零售模块</view>
        <view class="title">{{ id ? '编辑商品' : '商品上传' }}</view>
      </view>
      <button v-if="id" class="soft-button" @click="resetForm">新增</button>
    </view>

    <view class="soft-card form-card">
      <view class="segment">
        <view class="segment-item" :class="{ active: form.sourceType === 'stock' }" @click="changeSource('stock')">库存</view>
        <view class="segment-item" :class="{ active: form.sourceType === 'consignment' }" @click="changeSource('consignment')">代卖</view>
      </view>

      <view v-if="form.sourceType === 'stock'" class="field">
        <view class="field-label">库存商品</view>
        <picker :value="goodsIndex" :range="goodsList" range-key="name" @change="selectGoods">
          <view class="input picker">{{ selectedGoodsText }}</view>
        </picker>
      </view>

      <view class="field">
        <view class="field-label">商品名称</view>
        <input v-model.trim="form.name" class="input" placeholder="客户看到的名称" />
      </view>

      <view class="field">
        <view class="field-label">商品简述</view>
        <input v-model.trim="form.description" class="input" placeholder="例：甜度高、现切、约300g" />
      </view>

      <view class="field">
        <view class="field-label">商品种类</view>
        <picker :value="categoryIndex" :range="categories" range-key="label" @change="selectCategory">
          <view class="input picker">{{ categories[categoryIndex].label }}</view>
        </picker>
      </view>

      <view class="form-grid">
        <view class="field">
          <view class="field-label">计价方式</view>
          <picker :value="unitIndex" :range="unitOptions" range-key="label" @change="selectUnit">
            <view class="input picker">{{ unitOptions[unitIndex].label }}</view>
          </picker>
        </view>
        <view class="field">
          <view class="field-label">单价</view>
          <input v-model="form.price" class="input" type="digit" />
        </view>
        <view class="field">
          <view class="field-label">成本</view>
          <input v-model="form.costPrice" class="input" type="digit" />
        </view>
        <view class="field">
          <view class="field-label">成本佣金</view>
          <input v-model="form.costCommission" class="input" type="digit" />
        </view>
        <view class="field">
          <view class="field-label">售卖佣金</view>
          <input v-model="form.commission" class="input" type="digit" />
        </view>
        <view class="field">
          <view class="field-label">排序</view>
          <input v-model="form.sortOrder" class="input" type="number" />
        </view>
      </view>

      <view class="image-row">
        <image v-if="form.imageUrl" class="preview-image" :src="imageUrl(form.imageUrl)" mode="aspectFill"></image>
        <view v-else class="preview-image empty-image">图</view>
        <button class="soft-button image-button" :disabled="uploading" @click="chooseImage">{{ uploading ? '上传中' : '上传图片' }}</button>
      </view>
    </view>

    <button class="soft-button primary submit-button" :disabled="saving" @click="saveProduct">{{ saving ? '保存中' : '保存商品' }}</button>

    <view v-if="id" class="danger-zone">
      <view>
        <view class="danger-title">危险操作</view>
        <view class="danger-desc">永久删除商品和对应图片，历史零售记录仍保留商品快照。</view>
      </view>
      <button class="soft-button delete-button" :disabled="deleting" @click="deleteProduct">{{ deleting ? '删除中' : '删除商品' }}</button>
    </view>
  </view>
</template>

<script>
import { API_BASE } from '../../config/api'
import { request, requireLogin } from '../../utils/request'
import { RETAIL_CATEGORIES, unitText } from './constants'

const MAX_UPLOAD_IMAGE_SIZE = 1024 * 1024
const IMAGE_MAX_WIDTH = 1200
const IMAGE_MAX_HEIGHT = 1200

export default {
  data() {
    return {
      id: '',
      goodsList: [],
      categories: RETAIL_CATEGORIES,
      unitOptions: [
        { label: '按数量', value: 'qty' },
        { label: '按重量', value: 'weight' }
      ],
      form: {
        sourceType: 'stock',
        goodsId: '',
        lastStockGoodsId: '',
        name: '',
        description: '',
        category: 'special',
        unitType: 'qty',
        price: '',
        costPrice: '',
        costCommission: '0',
        commission: '0',
        imageUrl: '',
        sortOrder: '0'
      },
      saving: false,
      deleting: false,
      uploading: false
    }
  },
  computed: {
    selectedGoods() {
      return this.goodsList.find(item => Number(item.id) === Number(this.form.goodsId))
    },
    selectedGoodsText() {
      return this.selectedGoods ? `${this.selectedGoods.name} · ${unitText(this.selectedGoods.unitType)}` : '选择库存商品'
    },
    goodsIndex() {
      const index = this.goodsList.findIndex(item => Number(item.id) === Number(this.form.goodsId))
      return index < 0 ? 0 : index
    },
    categoryIndex() {
      const index = this.categories.findIndex(item => item.value === this.form.category)
      return index < 0 ? 0 : index
    },
    unitIndex() {
      const index = this.unitOptions.findIndex(item => item.value === this.form.unitType)
      return index < 0 ? 0 : index
    }
  },
  onLoad(query) {
    this.id = query.id || ''
    this.setPageTitle()
  },
  async onShow() {
    if (!requireLogin()) return
    await this.loadGoods()
    if (this.id) await this.loadProduct()
  },
  methods: {
    unitText,
    setPageTitle() {
      uni.setNavigationBarTitle({
        title: this.id ? '零售模块/编辑商品' : '零售模块/商品上传'
      })
    },
    imageUrl(url) {
      if (!url) return ''
      if (/^https?:\/\//.test(url)) return url
      return `${API_BASE.replace(/\/$/, '')}${url}`
    },
    async loadGoods() {
      this.goodsList = await request({ url: '/api/goods' })
      if (!this.id && this.form.sourceType === 'stock' && !this.form.goodsId && this.goodsList.length) {
        this.selectGoodsByIndex(0)
      }
    },
    async loadProduct() {
      const list = await request({ url: '/api/retail/products' })
      const product = list.find(item => String(item.id) === String(this.id))
      if (!product) return
      this.form = {
        sourceType: product.sourceType,
        goodsId: product.goodsId || '',
        lastStockGoodsId: product.goodsId || '',
        name: product.name,
        description: product.description || '',
        category: product.category,
        unitType: product.unitType,
        price: String(product.price || ''),
        costPrice: String(product.costPrice || 0),
        costCommission: String(product.costCommission || 0),
        commission: String(product.commission || 0),
        imageUrl: product.imageUrl || '',
        sortOrder: String(product.sortOrder || 0)
      }
    },
    changeSource(sourceType) {
      this.form.sourceType = sourceType
      if (sourceType === 'consignment') {
        if (this.form.goodsId) this.form.lastStockGoodsId = this.form.goodsId
        this.form.goodsId = ''
        return
      }
      const savedIndex = this.goodsList.findIndex(item => Number(item.id) === Number(this.form.lastStockGoodsId))
      if (savedIndex >= 0) {
        this.selectGoodsByIndex(savedIndex)
      } else if (!this.form.goodsId && this.goodsList.length) {
        this.selectGoodsByIndex(0)
      }
    },
    selectGoods(event) {
      this.selectGoodsByIndex(Number(event.detail.value))
    },
    selectGoodsByIndex(index) {
      const goods = this.goodsList[index]
      if (!goods) return
      this.form.goodsId = goods.id
      this.form.lastStockGoodsId = goods.id
      this.form.name = goods.name
      this.form.unitType = goods.unitType
      this.form.price = String(goods.salePrice || goods.costPrice || 0)
      this.form.costPrice = String(goods.costPrice || 0)
      this.form.costCommission = String(goods.defaultCommission || 0)
      this.form.commission = String(goods.saleCommission || 0)
    },
    selectCategory(event) {
      this.form.category = this.categories[Number(event.detail.value)].value
    },
    selectUnit(event) {
      this.form.unitType = this.unitOptions[Number(event.detail.value)].value
    },
    chooseImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: async (res) => {
          const path = res.tempFilePaths[0]
          const file = res.tempFiles && res.tempFiles[0]
          if (!path) return
          try {
            const imageFile = await this.prepareImageForUpload(path, file)
            this.uploadImage(imageFile.path, imageFile.file)
          } catch (err) {
            uni.showToast({ title: err.message || '图片压缩失败', icon: 'none' })
          }
        }
      })
    },
    async prepareImageForUpload(filePath, file) {
      const originalSize = await this.getImageSize(filePath, file)
      if (originalSize <= MAX_UPLOAD_IMAGE_SIZE) {
        return { path: filePath, file }
      }
      const compressed = await this.compressImage(filePath, file)
      const compressedSize = await this.getImageSize(compressed.path, compressed.file)
      if (compressedSize > MAX_UPLOAD_IMAGE_SIZE) {
        throw new Error('图片已压缩但仍超过1MB，请重新拍近一点或换小图')
      }
      return compressed
    },
    getImageSize(filePath, file) {
      const size = Number(file?.size || 0)
      if (size > 0) return Promise.resolve(size)
      if (!uni.getFileInfo) return Promise.resolve(0)
      return new Promise((resolve) => {
        uni.getFileInfo({
          filePath,
          success: res => resolve(Number(res.size || 0)),
          fail: () => resolve(0)
        })
      })
    },
    compressImage(filePath, file) {
      if (uni.compressImage) {
        return new Promise((resolve, reject) => {
          uni.compressImage({
            src: filePath,
            quality: 60,
            compressedWidth: IMAGE_MAX_WIDTH,
            compressedHeight: IMAGE_MAX_HEIGHT,
            success: res => resolve({ path: res.tempFilePath || filePath, file }),
            fail: () => reject(new Error('图片压缩失败'))
          })
        })
      }
      const target = file?.file || file
      if (typeof File !== 'undefined' && target instanceof File) {
        return this.compressBrowserImage(target)
      }
      return Promise.reject(new Error('当前端不支持自动压缩图片'))
    },
    compressBrowserImage(file) {
      return new Promise((resolve, reject) => {
        const image = new Image()
        const url = URL.createObjectURL(file)
        image.onload = () => {
          const scale = Math.min(1, IMAGE_MAX_WIDTH / image.width, IMAGE_MAX_HEIGHT / image.height)
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(image.width * scale))
          canvas.height = Math.max(1, Math.round(image.height * scale))
          const ctx = canvas.getContext('2d')
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(url)
            if (!blob) {
              reject(new Error('图片压缩失败'))
              return
            }
            resolve({
              path: URL.createObjectURL(blob),
              file: new File([blob], file.name || 'retail.jpg', { type: 'image/jpeg' })
            })
          }, 'image/jpeg', 0.72)
        }
        image.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('图片压缩失败'))
        }
        image.src = url
      })
    },
    async uploadImage(filePath, file) {
      this.uploading = true
      try {
        const imageBase64 = await this.readImageBase64(filePath, file)
        if (Math.floor(imageBase64.length * 0.75) > MAX_UPLOAD_IMAGE_SIZE) {
          throw new Error('图片压缩后仍超过1MB，请换小图')
        }
        const result = await request({
          url: '/api/retail/uploads/image',
          method: 'POST',
          data: {
            imageBase64,
            filename: file?.name || file?.path || filePath || 'retail.jpg'
          },
          timeout: 30000
        })
        this.form.imageUrl = result.url || ''
      } catch (err) {
        uni.showToast({ title: err.message || '图片上传失败', icon: 'none' })
      } finally {
        this.uploading = false
      }
    },
    readImageBase64(filePath, file) {
      // #ifdef MP-WEIXIN
      return new Promise((resolve, reject) => {
        const fileManager = uni.getFileSystemManager?.()
        if (!fileManager) {
          reject(new Error('当前端不支持读取图片'))
          return
        }
        fileManager.readFile({
          filePath,
          success: ({ data }) => {
            const imageBase64 = uni.arrayBufferToBase64 ? uni.arrayBufferToBase64(data) : wx.arrayBufferToBase64(data)
            resolve(imageBase64)
          },
          fail: () => reject(new Error('图片读取失败'))
        })
      })
      // #endif

      // #ifdef APP-PLUS
      return new Promise((resolve, reject) => {
        plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
          entry.file((targetFile) => {
            const reader = new plus.io.FileReader()
            reader.onloadend = (event) => {
              const text = String(event.target.result || '')
              resolve(text.includes(',') ? text.split(',').pop() : text)
            }
            reader.onerror = () => reject(new Error('图片读取失败'))
            reader.readAsDataURL(targetFile)
          }, () => reject(new Error('图片读取失败')))
        }, () => reject(new Error('图片读取失败')))
      })
      // #endif

      // #ifndef MP-WEIXIN
      // #ifndef APP-PLUS
      const target = file?.file || file
      if (typeof File !== 'undefined' && target instanceof File) {
        return this.readBlobAsBase64(target)
      }
      if (typeof Blob !== 'undefined' && target instanceof Blob) {
        return this.readBlobAsBase64(target)
      }
      return fetch(filePath)
        .then(res => res.blob())
        .then(blob => this.readBlobAsBase64(blob))
      // #endif
      // #endif
    },
    readBlobAsBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const text = String(reader.result || '')
          resolve(text.includes(',') ? text.split(',').pop() : text)
        }
        reader.onerror = () => reject(new Error('图片读取失败'))
        reader.readAsDataURL(blob)
      })
    },
    validate() {
      if (this.form.sourceType === 'stock' && !this.form.goodsId) return '请选择库存商品'
      if (!this.form.name.trim()) return '请填写商品名称'
      if (Number(this.form.price || 0) <= 0) return '请填写单价'
      if (Number(this.form.costPrice || 0) < 0) return '成本不能小于0'
      return ''
    },
    async saveProduct() {
      const message = this.validate()
      if (message) {
        uni.showToast({ title: message, icon: 'none' })
        return
      }
      this.saving = true
      try {
        const payload = {
          ...this.form,
          goodsId: this.form.sourceType === 'stock' ? this.form.goodsId : null
        }
        await request({
          url: this.id ? `/api/retail/products/${this.id}` : '/api/retail/products',
          method: this.id ? 'PUT' : 'POST',
          data: payload
        })
        uni.showToast({ title: '已保存', icon: 'success' })
        if (!this.id) this.resetForm()
      } finally {
        this.saving = false
      }
    },
    deleteProduct() {
      uni.showModal({
        title: '永久删除商品',
        content: '该商品删除后不可逆，会同时删除商品图片。历史零售记录仍会保留商品快照。',
        confirmText: '永久删除',
        confirmColor: '#d64b3f',
        success: async (res) => {
          if (!res.confirm) return
          this.deleting = true
          try {
            await request({ url: `/api/retail/products/${this.id}`, method: 'DELETE' })
            uni.showToast({ title: '已删除', icon: 'success' })
            uni.navigateBack()
          } finally {
            this.deleting = false
          }
        }
      })
    },
    resetForm() {
      this.id = ''
      this.setPageTitle()
      this.form = {
        sourceType: 'stock',
        goodsId: '',
        lastStockGoodsId: '',
        name: '',
        description: '',
        category: 'special',
        unitType: 'qty',
        price: '',
        costPrice: '',
        costCommission: '0',
        commission: '0',
        imageUrl: '',
        sortOrder: '0'
      }
      if (this.goodsList.length) this.selectGoodsByIndex(0)
    }
  }
}
</script>

<style scoped>
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 18rpx 8rpx 14rpx;
}

.eyebrow {
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
}

.title {
  margin-top: 8rpx;
  color: #17362f;
  font-size: 42rpx;
  font-weight: 900;
}

.form-card {
  display: grid;
  gap: 18rpx;
}

.segment {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
}

.segment-item {
  height: 64rpx;
  border-radius: 16rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 64rpx;
  text-align: center;
}

.segment-item.active {
  background: #16945f;
  color: #ffffff;
}

.field-label {
  margin-bottom: 8rpx;
  color: #17362f;
  font-size: 24rpx;
  font-weight: 900;
}

.picker {
  display: flex;
  align-items: center;
  min-height: 66rpx;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.image-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.preview-image {
  width: 180rpx;
  height: 150rpx;
  border-radius: 18rpx;
  background: #e8f6ed;
}

.empty-image {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #16945f;
  font-size: 44rpx;
  font-weight: 900;
}

.image-button {
  width: 180rpx;
  height: 68rpx;
  min-height: 68rpx;
  background: #e8f6ed;
  color: #166b4e;
}

.submit-button {
  width: 100%;
  margin-top: 22rpx;
}

.danger-zone {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 176rpx;
  gap: 16rpx;
  align-items: center;
  margin-top: 46rpx;
  padding: 20rpx;
  border: 2rpx solid #f2b4ad;
  border-radius: 18rpx;
  background: #fff3f1;
}

.danger-title {
  color: #b82921;
  font-size: 28rpx;
  font-weight: 900;
}

.danger-desc {
  margin-top: 6rpx;
  color: #9b5b55;
  font-size: 22rpx;
  line-height: 1.45;
}

.delete-button {
  width: 176rpx;
  height: 66rpx;
  min-height: 66rpx;
  background: #d93025;
  color: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(217, 48, 37, 0.18);
}

.retail-upload {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(11, 154, 135, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f2fffb 0%, #e7fbf6 100%);
}

.soft-card,
.form-card,
.preview-card {
  border-color: #bde5df;
  background: linear-gradient(145deg, #ffffff 0%, #effdfa 100%);
}

.section-title,
.field-label {
  color: #0d4d45;
}

.primary,
.save-button {
  background: #0b9a87;
  color: #ffffff;
}

.soft-button:not(.primary):not(.delete-button) {
  background: #dff6f1;
  color: #0b9a87;
}
</style>
