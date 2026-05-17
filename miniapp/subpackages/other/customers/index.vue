<template>
  <view class="page customers-page">
    <view class="customer-head">
      <view>
        <view class="head-label">东成果业</view>
        <view class="head-title">客户列表</view>
      </view>
      <view class="head-count">{{ filteredCount }}人</view>
    </view>

    <view class="soft-card search-card">
      <input
        class="search-input"
        v-model.trim="keyword"
        placeholder="搜索客户名称"
        confirm-type="search"
        @input="handleSearchInput"
        @confirm="loadCustomers"
      />
      <button v-if="keyword" class="clear-button" @click="clearSearch">清空</button>
    </view>

    <view v-if="loading" class="soft-card empty">正在读取客户...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <view v-else class="list-wrap">
      <scroll-view
        class="customer-scroll"
        scroll-y
        :scroll-into-view="activeAnchor"
        scroll-with-animation
      >
        <view v-for="group in groups" :key="group.initial" :id="anchorId(group.initial)" class="group-block">
          <view class="group-title">{{ group.initial }}</view>
          <view
            v-for="customer in group.items"
            :key="customer.id"
            class="customer-row"
            @click="openDebt(customer.id)"
          >
            <view class="customer-main">
              <view class="customer-name">{{ customer.name }}</view>
              <view class="customer-meta">{{ customer.unpaidOrderCount }}笔未付订单</view>
            </view>
            <view class="debt-box" :class="{ clear: Number(customer.debtAmount || 0) <= 0 }">
              <view class="debt-label">欠账</view>
              <view class="debt-money">¥{{ money(customer.debtAmount) }}</view>
            </view>
          </view>
        </view>

        <view v-if="!groups.length" class="soft-card empty-state">
          <view class="empty-title">暂无客户</view>
          <view class="empty-text">有客户订单后会在这里显示。</view>
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
      customers: [],
      loading: false,
      error: '',
      searchTimer: null,
      activeAnchor: '',
      letters: LETTERS
    }
  },
  computed: {
    groups() {
      const map = this.customers.reduce((result, customer) => {
        const initial = customer.initial || '#'
        if (!result[initial]) result[initial] = []
        result[initial].push(customer)
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
      return this.customers.length
    }
  },
  onShow() {
    if (requireLogin()) this.loadCustomers()
  },
  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },
  methods: {
    money,
    anchorId(letter) {
      return `customer-group-${letter === '#' ? 'other' : letter}`
    },
    handleSearchInput() {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.loadCustomers()
      }, 260)
    },
    clearSearch() {
      this.keyword = ''
      this.loadCustomers()
    },
    jumpTo(letter) {
      if (!this.availableLetters.includes(letter)) return
      this.activeAnchor = ''
      this.$nextTick(() => {
        this.activeAnchor = this.anchorId(letter)
      })
    },
    openDebt(id) {
      uni.navigateTo({ url: `/pages/orders/debt?customerId=${id}` })
    },
    async loadCustomers() {
      this.loading = true
      this.error = ''
      try {
        const query = this.keyword ? `?q=${encodeURIComponent(this.keyword)}` : ''
        const result = await request({ url: `/api/customers${query}` })
        this.customers = Array.isArray(result) ? result : []
      } catch (err) {
        this.customers = []
        this.error = err.message || '客户列表读取失败'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.customers-page {
  padding-right: 58rpx;
}

.customer-head {
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

.customer-scroll {
  max-height: calc(100vh - 250rpx - var(--window-bottom, 0px));
}

.group-title {
  padding: 18rpx 8rpx 10rpx;
  color: #16945f;
  font-size: 26rpx;
  font-weight: 900;
}

.customer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  min-height: 116rpx;
  margin-bottom: 14rpx;
  padding: 18rpx;
  border: 2rpx solid #d7ead9;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(25, 55, 44, 0.07);
}

.customer-row:active {
  background: #f2fbf4;
}

.customer-main {
  min-width: 0;
}

.customer-name {
  overflow: hidden;
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-meta {
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
</style>
