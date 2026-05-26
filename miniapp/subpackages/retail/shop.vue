<template>
  <view class="page retail-shop">
    <view class="shop-head">
      <view>
        <view class="shop-name">{{ storeName }}</view>
        <view class="shop-address">{{ storeAddress }}</view>
      </view>
      <button v-if="staffView" class="share-button" open-type="share">分享</button>
    </view>

    <view class="search-row">
      <input v-model.trim="keyword" class="input search-input" placeholder="搜索水果" @input="filterProducts" />
    </view>

    <view class="shop-body">
      <view class="category-side">
        <view
          v-for="category in categoryTabs"
          :key="category.value"
          class="category-tab"
          :class="{ active: activeCategory === category.value }"
          @click="jumpCategory(category.value)"
        >
          {{ category.label }}
        </view>
      </view>

      <scroll-view
        class="product-list"
        scroll-y
        :scroll-into-view="activeAnchor"
        scroll-with-animation
        enhanced
        :show-scrollbar="true"
      >
        <view v-if="loading" class="soft-card empty">正在读取商品...</view>
        <view v-else-if="error" class="soft-card empty error">{{ error }}</view>
        <view v-else>
          <view v-for="group in productGroups" :id="anchorId(group.value)" :key="group.value" class="category-group">
            <view class="group-title">{{ group.label }}</view>
            <view v-for="product in group.items" :key="product.id" class="product-row">
              <image v-if="product.imageDataUrl || product.imageUrl" class="product-image" :src="imageUrl(product)" mode="aspectFill"></image>
              <view v-else class="product-image placeholder">果</view>
              <view class="product-info">
                <view class="product-head">
                  <view class="product-name">{{ product.name }}</view>
                  <view class="unit-badge">{{ unitText(product.unitType) }}</view>
                </view>
                <view class="product-meta">{{ product.description || product.categoryText }}</view>
                <view class="product-price">¥{{ money(product.price) }}</view>
              </view>
            </view>
          </view>
          <view v-if="!productGroups.length" class="soft-card empty-state">暂无商品</view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request'
import { API_BASE, RETAIL_STORE_ADDRESS, RETAIL_STORE_NAME, shouldUseAnyService } from '../../config/api'
import { money } from '../../utils/format'
import { RETAIL_CATEGORIES, unitText } from './constants'

export default {
  data() {
    return {
      storeName: RETAIL_STORE_NAME,
      storeAddress: RETAIL_STORE_ADDRESS,
      categories: RETAIL_CATEGORIES,
      activeCategory: 'all',
      activeAnchor: '',
      staffView: false,
      keyword: '',
      products: [],
      loading: false,
      error: ''
    }
  },
  computed: {
    categoryTabs() {
      return [{ value: 'all', label: '全部' }, ...this.categories]
    },
    filteredProducts() {
      const keyword = this.keyword.trim()
      return this.products.filter(product =>
        !keyword || product.name.includes(keyword)
      )
    },
    productGroups() {
      return this.categories
        .map(category => ({
          ...category,
          items: this.filteredProducts.filter(product => product.category === category.value)
        }))
        .filter(group => group.items.length)
    }
  },
  onLoad(query) {
    this.staffView = query.staff === '1'
  },
  onShow() {
    this.loadProducts()
  },
  onShareAppMessage() {
    return {
      title: `${this.storeName}今日水果`,
      path: '/subpackages/retail/shop'
    }
  },
  methods: {
    money,
    unitText,
    filterProducts() {},
    anchorId(value) {
      return `retail-category-${value}`
    },
    jumpCategory(value) {
      this.activeCategory = value
      this.activeAnchor = ''
      this.$nextTick(() => {
        this.activeAnchor = value === 'all' ? '' : this.anchorId(value)
      })
    },
    imageUrl(product) {
      const url = product.imageDataUrl || product.imageUrl || ''
      if (!url) return ''
      if (/^(https?:\/\/|data:image\/)/.test(url)) return url
      return `${API_BASE.replace(/\/$/, '')}${url}`
    },
    async loadProducts() {
      this.loading = true
      this.error = ''
      try {
        const imageParam = shouldUseAnyService() ? '?imageData=1' : ''
        this.products = await request({ url: `/api/retail/products/public${imageParam}`, auth: false })
      } catch (err) {
        this.products = []
        this.error = err.message || '商品读取失败'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.retail-shop {
  padding: 0;
}

.shop-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 24rpx 16rpx;
  background: #ffffff;
}

.shop-name {
  color: #17362f;
  font-size: 38rpx;
  font-weight: 900;
}

.shop-address {
  margin-top: 6rpx;
  color: #718078;
  font-size: 24rpx;
}

.share-button {
  width: 112rpx;
  height: 56rpx;
  min-height: 56rpx;
  border-radius: 16rpx;
  background: #16945f;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 900;
}

.search-row {
  padding: 12rpx 24rpx 18rpx;
  background: #ffffff;
}

.search-input {
  min-height: 66rpx;
}

.shop-body {
  display: grid;
  grid-template-columns: 160rpx minmax(0, 1fr);
  gap: 18rpx;
  padding: 16rpx 18rpx 24rpx;
}

.category-side {
  display: grid;
  align-content: start;
  gap: 12rpx;
}

.category-tab {
  min-height: 72rpx;
  padding: 0 10rpx;
  border-radius: 16rpx;
  background: #ffffff;
  color: #51625a;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 72rpx;
  text-align: center;
}

.category-tab.active {
  background: #16945f;
  color: #ffffff;
}

.product-list {
  max-height: calc(100vh - 210rpx - var(--window-bottom, 0px));
}

.category-group {
  margin-bottom: 12rpx;
}

.group-title {
  margin-bottom: 12rpx;
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
}

.product-row {
  display: grid;
  grid-template-columns: 176rpx minmax(0, 1fr);
  gap: 20rpx;
  margin-bottom: 18rpx;
  min-height: 164rpx;
  padding: 20rpx;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(25, 55, 44, 0.07);
}

.product-image {
  width: 176rpx;
  height: 150rpx;
  border-radius: 16rpx;
  background: #e8f6ed;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #16945f;
  font-size: 42rpx;
  font-weight: 900;
}

.product-name {
  min-width: 0;
  color: #17362f;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1.35;
}

.product-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 118rpx;
  gap: 12rpx;
  align-items: start;
}

.unit-badge {
  height: 54rpx;
  border-radius: 16rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 54rpx;
  text-align: center;
}

.product-meta {
  margin-top: 8rpx;
  color: #718078;
  font-size: 23rpx;
}

.product-price {
  margin-top: 14rpx;
  color: #17362f;
  font-size: 40rpx;
  font-weight: 900;
}

.empty,
.empty-state {
  color: #718078;
  text-align: center;
}

.error {
  color: #d64b3f;
}

.retail-shop {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(11, 154, 135, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f2fffb 0%, #e7fbf6 100%);
}

.soft-card,
.product-card,
.cart-card,
.category-card {
  border-color: #bde5df;
  background: linear-gradient(145deg, #ffffff 0%, #effdfa 100%);
}

.shop-title,
.section-title,
.product-name,
.product-price {
  color: #0d4d45;
}

.unit-badge,
.soft-button:not(.danger) {
  background: #dff6f1;
  color: #0b9a87;
}

.primary,
.cart-button {
  background: #0b9a87;
  color: #ffffff;
}
</style>
