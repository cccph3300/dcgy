<template>
  <view class="page retail-products">
    <view class="head">
      <view>
        <view class="eyebrow">零售模块</view>
        <view class="title">商品列表</view>
      </view>
      <button class="soft-button share-button" @click="openShop">客户页</button>
    </view>

    <view class="soft-card filter-card">
      <input v-model.trim="keyword" class="input" placeholder="搜索商品" @input="resetAndLoad" />
      <picker :value="categoryIndex" :range="categoryOptions" range-key="label" @change="selectCategory">
        <view class="input picker">{{ categoryOptions[categoryIndex].label }}</view>
      </picker>
    </view>

    <view v-if="loading" class="soft-card empty">正在读取商品...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>
    <view v-else>
      <view v-for="product in products" :key="product.id" class="product-card">
        <image v-if="product.imageUrl" class="product-image" :src="imageUrl(product.imageUrl)" mode="aspectFill"></image>
        <view v-else class="product-image placeholder">果</view>
        <view class="product-main">
          <view class="product-top">
            <view class="product-name">{{ product.name }}</view>
          </view>
          <view class="product-meta">{{ product.categoryText }} · {{ sourceText(product.sourceType) }} · {{ unitText(product.unitType) }}</view>
          <view class="product-price">¥{{ money(product.price) }} / 成本 ¥{{ money(product.costPrice) }} / 佣金 ¥{{ money(product.commission) }}</view>
        </view>
        <view class="actions">
          <button class="mini-button" @click="editProduct(product.id)">编辑</button>
          <button class="mini-button" :class="{ danger: product.enabled }" @click="toggleStatus(product)">
            {{ product.enabled ? '下架' : '上架' }}
          </button>
        </view>
      </view>
      <view v-if="!products.length" class="soft-card empty-state">暂无商品</view>
      <view class="pager">
        <button class="pager-button" :disabled="page <= 1 || loading" @click="changePage(page - 1)">上一页</button>
        <text>{{ page }} / {{ totalPages }}</text>
        <button class="pager-button" :disabled="page >= totalPages || loading" @click="changePage(page + 1)">下一页</button>
      </view>
    </view>
  </view>
</template>

<script>
import { API_BASE } from '../../config/api'
import { request, requireLogin } from '../../utils/request'
import { money } from '../../utils/format'
import { RETAIL_CATEGORIES, sourceText, unitText } from './constants'

export default {
  data() {
    return {
      keyword: '',
      category: '',
      categoryOptions: [{ label: '全部种类', value: '' }, ...RETAIL_CATEGORIES],
      products: [],
      page: 1,
      pageSize: 5,
      totalPages: 1,
      loading: false,
      error: ''
    }
  },
  computed: {
    categoryIndex() {
      const index = this.categoryOptions.findIndex(item => item.value === this.category)
      return index < 0 ? 0 : index
    }
  },
  onShow() {
    if (requireLogin()) this.loadProducts()
  },
  methods: {
    money,
    sourceText,
    unitText,
    imageUrl(url) {
      if (!url) return ''
      if (/^https?:\/\//.test(url)) return url
      return `${API_BASE.replace(/\/$/, '')}${url}`
    },
    resetAndLoad() {
      this.page = 1
      this.loadProducts()
    },
    selectCategory(event) {
      this.category = this.categoryOptions[Number(event.detail.value)].value
      this.page = 1
      this.loadProducts()
    },
    openShop() {
      uni.navigateTo({ url: '/subpackages/retail/shop?staff=1' })
    },
    editProduct(id) {
      uni.navigateTo({ url: `/subpackages/retail/upload?id=${id}` })
    },
    changePage(page) {
      this.page = page
      this.loadProducts()
    },
    async toggleStatus(product) {
      await request({
        url: `/api/retail/products/${product.id}/status`,
        method: 'PATCH',
        data: { enabled: !product.enabled }
      })
      uni.showToast({ title: product.enabled ? '已下架' : '已上架', icon: 'success' })
      this.loadProducts()
    },
    async loadProducts() {
      this.loading = true
      this.error = ''
      try {
        const params = []
        if (this.keyword) params.push(`q=${encodeURIComponent(this.keyword)}`)
        if (this.category) params.push(`category=${encodeURIComponent(this.category)}`)
        params.push(`page=${this.page}`)
        params.push(`pageSize=${this.pageSize}`)
        const query = params.length ? `?${params.join('&')}` : ''
        const result = await request({ url: `/api/retail/products${query}` })
        this.products = result.items || []
        this.totalPages = result.totalPages || 1
      } catch (err) {
        this.products = []
        this.totalPages = 1
        this.error = err.message || '商品读取失败'
      } finally {
        this.loading = false
      }
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

.share-button {
  width: 128rpx;
  height: 62rpx;
  min-height: 62rpx;
  background: #ef6f5e;
  color: #ffffff;
  box-shadow: 0 10rpx 20rpx rgba(239, 111, 94, 0.18);
}

.filter-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190rpx;
  gap: 12rpx;
  padding: 14rpx;
}

.pager {
  display: grid;
  grid-template-columns: 150rpx minmax(0, 1fr) 150rpx;
  gap: 16rpx;
  align-items: center;
  padding: 12rpx 8rpx 28rpx;
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

.picker {
  display: flex;
  align-items: center;
}

.product-card {
  display: grid;
  grid-template-columns: 148rpx minmax(0, 1fr) 118rpx;
  gap: 16rpx;
  margin-bottom: 16rpx;
  padding: 16rpx;
  border: 2rpx solid #d7ead9;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(25, 55, 44, 0.07);
}

.product-image {
  width: 148rpx;
  height: 132rpx;
  border-radius: 14rpx;
  background: #e8f6ed;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #16945f;
  font-size: 40rpx;
  font-weight: 900;
}

.product-top {
  display: flex;
  gap: 10rpx;
  justify-content: space-between;
}

.product-name {
  color: #17362f;
  font-size: 29rpx;
  font-weight: 900;
}

.product-meta,
.product-price {
  margin-top: 8rpx;
  color: #718078;
  font-size: 23rpx;
}

.product-price {
  color: #17362f;
  font-weight: 900;
}

.actions {
  display: grid;
  gap: 12rpx;
  align-content: center;
}

.mini-button {
  width: 118rpx;
  height: 64rpx;
  min-height: 64rpx;
  border-radius: 16rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 25rpx;
  font-weight: 900;
}

.mini-button.danger {
  background: #d93025;
  color: #ffffff;
  box-shadow: 0 8rpx 18rpx rgba(217, 48, 37, 0.18);
}

.empty,
.empty-state {
  color: #718078;
  text-align: center;
}

.error {
  color: #d64b3f;
}
</style>
