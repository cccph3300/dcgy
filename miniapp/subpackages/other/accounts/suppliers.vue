<template>
  <view class="page suppliers-page">
    <view class="supplier-head">
      <view>
        <view class="head-label">东成果业</view>
        <view class="head-title">货主列表</view>
      </view>
      <view class="head-count">{{ filteredCount }}人</view>
    </view>

    <view class="soft-card search-card">
      <input
        v-model.trim="keyword"
        class="search-input"
        placeholder="搜索货主名称"
        confirm-type="search"
        @input="handleSearchInput"
        @confirm="loadSuppliers"
      />
      <button v-if="keyword" class="clear-button" @click="clearSearch">清空</button>
    </view>

    <view v-if="loading" class="soft-card empty">正在读取货主...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <view v-else class="list-wrap">
      <scroll-view class="supplier-scroll" scroll-y :scroll-into-view="activeAnchor" scroll-with-animation>
        <view v-for="group in groups" :key="group.initial" :id="anchorId(group.initial)" class="group-block">
          <view class="group-title">{{ group.initial }}</view>
          <view
            v-for="supplier in group.items"
            :key="supplier.id"
            class="supplier-swipe"
            @touchstart="touchSupplierStart"
            @touchend="touchSupplierEnd($event, supplier)"
          >
            <button class="delete-button" :disabled="deletingSupplierId === supplier.id" @click.stop="confirmDeleteSupplier(supplier)">
              {{ deletingSupplierId === supplier.id ? '删除中' : '删除' }}
            </button>
            <view
              class="supplier-row"
              :class="{ swiped: swipedSupplierId === supplier.id }"
              @click="handleSupplierClick(supplier)"
            >
              <view class="supplier-main">
                <view class="supplier-name">{{ supplier.name }}</view>
                <view class="supplier-meta">{{ supplier.unpaidEntryCount }}笔未付入账</view>
              </view>
              <view class="debt-box" :class="{ clear: Number(supplier.debtAmount || 0) <= 0 }">
                <view class="debt-label">欠账</view>
                <view class="debt-money">¥{{ money(supplier.debtAmount) }}</view>
              </view>
            </view>
          </view>
        </view>

        <view v-if="!groups.length" class="soft-card empty-state">
          <view class="empty-title">暂无货主</view>
          <view class="empty-text">有入账记录后会在这里显示。</view>
        </view>
      </scroll-view>

      <view class="letter-index">
        <view
          v-for="letter in letters"
          :key="letter"
          class="letter"
          :class="{ active: availableLetters.includes(letter) }"
          @click="jumpTo(letter)"
        >
          {{ letter }}
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { money } from '../../../utils/format'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#']

export default {
  data() {
    return {
      keyword: '',
      suppliers: [],
      loading: false,
      error: '',
      searchTimer: null,
      swipedSupplierId: null,
      touchStartX: 0,
      deletingSupplierId: null,
      activeAnchor: '',
      letters: LETTERS
    }
  },
  computed: {
    groups() {
      const map = this.suppliers.reduce((result, supplier) => {
        const initial = supplier.initial || '#'
        if (!result[initial]) result[initial] = []
        result[initial].push(supplier)
        return result
      }, {})
      return this.letters
        .filter(letter => map[letter]?.length)
        .map(letter => ({
          initial: letter,
          items: map[letter]
        }))
    },
    availableLetters() {
      return this.groups.map(group => group.initial)
    },
    filteredCount() {
      return this.suppliers.length
    }
  },
  onShow() {
    if (requireLogin()) this.loadSuppliers()
  },
  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },
  methods: {
    money,
    anchorId(letter) {
      return `supplier-group-${letter === '#' ? 'other' : letter}`
    },
    handleSearchInput() {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.loadSuppliers(), 260)
    },
    clearSearch() {
      this.keyword = ''
      this.loadSuppliers()
    },
    jumpTo(letter) {
      if (!this.availableLetters.includes(letter)) return
      this.activeAnchor = ''
      this.$nextTick(() => {
        this.activeAnchor = this.anchorId(letter)
      })
    },
    touchSupplierStart(event) {
      this.touchStartX = event.changedTouches?.[0]?.clientX || 0
    },
    touchSupplierEnd(event, supplier) {
      const endX = event.changedTouches?.[0]?.clientX || 0
      const diff = endX - this.touchStartX
      if (diff < -36) {
        this.swipedSupplierId = supplier.id
      } else if (diff > 28) {
        this.swipedSupplierId = null
      }
    },
    handleSupplierClick(supplier) {
      if (this.swipedSupplierId === supplier.id) {
        this.swipedSupplierId = null
        return
      }
      this.openDebt(supplier.id)
    },
    openDebt(id) {
      uni.navigateTo({ url: `/subpackages/other/accounts/debt?supplierId=${id}` })
    },
    confirmDeleteSupplier(supplier) {
      uni.showModal({
        title: '删除货主？',
        content: `操作不可逆。\n货主：${supplier.name}`,
        confirmText: '删除',
        confirmColor: '#d64b3f',
        success: async (res) => {
          if (!res.confirm) return
          await this.deleteSupplier(supplier)
        }
      })
    },
    async deleteSupplier(supplier) {
      if (this.deletingSupplierId) return
      this.deletingSupplierId = supplier.id
      try {
        await request({ url: `/api/suppliers/${supplier.id}`, method: 'DELETE' })
        uni.showToast({ title: '已删除货主', icon: 'success' })
        this.swipedSupplierId = null
        await this.loadSuppliers()
      } catch (err) {
        uni.showToast({
          title: err.message || '删除失败',
          icon: 'none'
        })
      } finally {
        this.deletingSupplierId = null
      }
    },
    async loadSuppliers() {
      this.loading = true
      this.error = ''
      try {
        const query = this.keyword ? `?q=${encodeURIComponent(this.keyword)}` : ''
        const result = await request({ url: `/api/suppliers${query}` })
        this.suppliers = Array.isArray(result) ? result : []
      } catch (err) {
        this.suppliers = []
        this.error = err.message || '货主列表读取失败'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.suppliers-page {
  padding-right: 58rpx;
}

.supplier-head {
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

.head-count {
  min-width: 92rpx;
  height: 52rpx;
  border-radius: 18rpx;
  background: #fff6cf;
  color: #17362f;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 52rpx;
  text-align: center;
}

.search-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12rpx;
  align-items: center;
  padding: 14rpx;
}

.search-input {
  height: 64rpx;
  padding: 0 18rpx;
  border: 1rpx solid #dce8da;
  border-radius: 14rpx;
  background: #f8fbf4;
  color: #17362f;
  font-size: 26rpx;
}

.clear-button {
  width: 96rpx;
  height: 58rpx;
  min-height: 58rpx;
  border-radius: 14rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
}

.list-wrap {
  position: relative;
}

.supplier-scroll {
  max-height: calc(100vh - 250rpx - var(--window-bottom, 0px));
}

.group-title {
  padding: 18rpx 8rpx 10rpx;
  color: #16945f;
  font-size: 26rpx;
  font-weight: 900;
}

.supplier-swipe {
  position: relative;
  margin-bottom: 14rpx;
  border-radius: 18rpx;
  overflow: hidden;
}

.supplier-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  min-height: 116rpx;
  padding: 18rpx;
  border: 2rpx solid #d7ead9;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(25, 55, 44, 0.07);
  transition: transform 0.18s ease;
  will-change: transform;
}

.supplier-row.swiped {
  transform: translateX(-132rpx);
}

.supplier-row:active {
  background: #f2fbf4;
}

.delete-button {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 0;
  width: 124rpx;
  height: 95%;
  min-height: 95%;
  margin: 5rpx;
  border-radius: 0 18rpx 18rpx 0;
  background: #d64b3f;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 116rpx;

}

.delete-button::after {
  display: none;
}

.supplier-main {
  min-width: 0;
}

.supplier-name {
  overflow: hidden;
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supplier-meta {
  margin-top: 8rpx;
  color: #718078;
  font-size: 24rpx;
}

.debt-box {
  flex: 0 0 auto;
  min-width: 178rpx;
  text-align: right;
}

.debt-label {
  color: #718078;
  font-size: 22rpx;
  font-weight: 800;
}

.debt-money {
  margin-top: 4rpx;
  color: #d64b3f;
  font-size: 30rpx;
  font-weight: 900;
}

.debt-box.clear .debt-money {
  color: #16945f;
}

.letter-index {
  position: fixed;
  right: 12rpx;
  top: 210rpx;
  z-index: 2;
  display: grid;
  gap: 2rpx;
  padding: 8rpx 6rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 8rpx 20rpx rgba(25, 55, 44, 0.08);
}

.letter {
  width: 34rpx;
  height: 28rpx;
  border-radius: 10rpx;
  color: #a4aea8;
  font-size: 19rpx;
  font-weight: 900;
  line-height: 28rpx;
  text-align: center;
}

.letter.active {
  background: #e8f6ed;
  color: #166b4e;
}

.empty,
.empty-state {
  color: #718078;
  text-align: center;
}

.empty-state {
  padding: 52rpx 20rpx;
}

.empty-title {
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
}

.empty-text {
  margin-top: 8rpx;
  color: #718078;
  font-size: 24rpx;
}

.error {
  color: #d64b3f;
}

.suppliers-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(217, 120, 23, 0.14), transparent 190rpx),
    linear-gradient(180deg, #fffaf0 0%, #fff3dc 100%);
}

.head-label,
.group-title,
.letter.active {
  color: #d97817;
}

.head-title,
.supplier-name,
.empty-title {
  color: #6f3d05;
}

.head-count,
.search-card,
.supplier-row,
.empty-state {
  border-color: #efd7aa;
  background: linear-gradient(145deg, #ffffff 0%, #fff8e8 100%);
}

.search-input {
  border-color: #efd7aa;
  background: #fffaf0;
}

.clear-button,
.letter.active {
  background: #fff1d1;
}

.debt-money {
  color: #d97817;
}

.debt-box.clear .debt-money {
  color: #9b6b00;
}
</style>
