<template>
  <view class="page supermarkets-page">
    <view class="market-head">
      <view>
        <view class="head-label">东成果业</view>
        <view class="head-title">所有超市</view>
      </view>
      <view class="head-count">{{ filteredCount }}家</view>
    </view>

    <view class="soft-card search-card">
      <input
        v-model.trim="keyword"
        class="search-input"
        placeholder="搜索超市名称"
        confirm-type="search"
        @input="handleSearchInput"
        @confirm="loadMarkets"
      />
      <button v-if="keyword" class="clear-button" @click="clearSearch">清空</button>
    </view>

    <view v-if="loading" class="soft-card empty">正在读取超市...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <view v-else class="list-wrap">
      <scroll-view
        class="market-scroll"
        scroll-y
        :scroll-into-view="activeAnchor"
        scroll-with-animation
      >
        <view v-for="group in groups" :key="group.initial" :id="anchorId(group.initial)" class="group-block">
          <view class="group-title">{{ group.initial }}</view>
          <view
            v-for="market in group.items"
            :key="market.name"
            class="market-swipe"
            @touchstart="touchMarketStart"
            @touchend="touchMarketEnd($event, market)"
          >
            <button class="delete-button" :disabled="deletingMarketName === market.name" @click.stop="confirmDeleteMarket(market)">
              {{ deletingMarketName === market.name ? '删除中' : '删除' }}
            </button>
            <view
              class="market-row"
              :class="{ swiped: swipedMarketName === market.name }"
              @click="handleMarketClick(market)"
            >
              <view class="market-main">
                <view class="market-name">{{ market.name }}</view>
                <view class="market-meta">{{ market.unpaidOrderCount }}笔未结订单 · 共{{ market.orderCount }}单</view>
              </view>
              <view class="debt-box" :class="{ clear: Number(market.unpaidAmount || 0) <= 0 }">
                <view class="debt-label">未结</view>
                <view class="debt-money">¥{{ money(market.unpaidAmount) }}</view>
              </view>
            </view>
          </view>
        </view>

        <view v-if="!groups.length" class="soft-card empty-state">
          <view class="empty-title">暂无超市</view>
          <view class="empty-text">有超市送货单后会在这里显示。</view>
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
import { request, requireLogin } from '../../utils/request'
import { money } from '../../utils/format'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#']

export default {
  data() {
    return {
      keyword: '',
      markets: [],
      loading: false,
      error: '',
      searchTimer: null,
      swipedMarketName: '',
      touchStartX: 0,
      deletingMarketName: '',
      activeAnchor: '',
      letters: LETTERS
    }
  },
  computed: {
    groups() {
      const map = this.markets.reduce((result, market) => {
        const initial = market.initial || '#'
        if (!result[initial]) result[initial] = []
        result[initial].push(market)
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
      return this.markets.length
    }
  },
  onShow() {
    if (requireLogin()) this.loadMarkets()
  },
  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },
  methods: {
    money,
    anchorId(letter) {
      return `market-group-${letter === '#' ? 'other' : letter}`
    },
    handleSearchInput() {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.loadMarkets()
      }, 260)
    },
    clearSearch() {
      this.keyword = ''
      this.loadMarkets()
    },
    jumpTo(letter) {
      if (!this.availableLetters.includes(letter)) return
      this.activeAnchor = ''
      this.$nextTick(() => {
        this.activeAnchor = this.anchorId(letter)
      })
    },
    touchMarketStart(event) {
      this.touchStartX = event.changedTouches?.[0]?.clientX || 0
    },
    touchMarketEnd(event, market) {
      const endX = event.changedTouches?.[0]?.clientX || 0
      const diff = endX - this.touchStartX
      if (diff < -36) {
        this.swipedMarketName = market.name
      } else if (diff > 28) {
        this.swipedMarketName = ''
      }
    },
    handleMarketClick(market) {
      if (this.swipedMarketName === market.name) {
        this.swipedMarketName = ''
        return
      }
      this.openMarket(market)
    },
    openMarket(market) {
      uni.navigateTo({ url: `/subpackages/delivery/supermarket-detail?name=${encodeURIComponent(market.name)}` })
    },
    confirmDeleteMarket(market) {
      uni.showModal({
        title: '删除超市？',
        content: `确认删除“${market.name}”？必须先将该超市订单全部删除，才可以删除超市。`,
        confirmText: '删除',
        confirmColor: '#d64b3f',
        success: async (res) => {
          if (!res.confirm) return
          await this.deleteMarket(market)
        }
      })
    },
    async deleteMarket(market) {
      if (this.deletingMarketName) return
      this.deletingMarketName = market.name
      try {
        await request({
          url: `/api/supermarkets/by-name?name=${encodeURIComponent(market.name)}`,
          method: 'DELETE'
        })
        uni.showToast({ title: '已删除超市', icon: 'success' })
        this.swipedMarketName = ''
        await this.loadMarkets()
      } catch (err) {
        uni.showToast({ title: err.message || '删除失败', icon: 'none' })
      } finally {
        this.deletingMarketName = ''
      }
    },
    async loadMarkets() {
      this.loading = true
      this.error = ''
      try {
        const query = this.keyword ? `?q=${encodeURIComponent(this.keyword)}` : ''
        const result = await request({ url: `/api/supermarkets${query}` })
        this.markets = Array.isArray(result) ? result : []
      } catch (err) {
        this.markets = []
        this.error = err.message || '超市列表读取失败'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.supermarkets-page {
  padding-right: 58rpx;
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(77, 110, 216, 0.16), transparent 180rpx),
    radial-gradient(circle at 92% 10%, rgba(111, 88, 201, 0.12), transparent 220rpx),
    linear-gradient(180deg, #f6f8ff 0%, #eef3ff 100%);
}

.market-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 18rpx 8rpx 14rpx;
}

.head-label {
  color: #4d6ed8;
  font-size: 24rpx;
  font-weight: 900;
}

.head-title {
  margin-top: 8rpx;
  color: #1f2f63;
  font-size: 42rpx;
  font-weight: 900;
}

.head-count {
  min-width: 92rpx;
  height: 52rpx;
  border-radius: 18rpx;
  background: #e9eefb;
  color: #1f2f63;
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
  border-color: #cdd8fb;
  background: linear-gradient(145deg, #ffffff 0%, #f4f7ff 100%);
}

.search-input {
  height: 64rpx;
  padding: 0 18rpx;
  border: 1rpx solid #cdd8fb;
  border-radius: 14rpx;
  background: #f8faff;
  color: #1f2f63;
  font-size: 26rpx;
}

.clear-button {
  width: 96rpx;
  height: 58rpx;
  min-height: 58rpx;
  border-radius: 14rpx;
  background: #e9eefb;
  color: #4d6ed8;
  font-size: 24rpx;
  font-weight: 900;
}

.list-wrap {
  position: relative;
}

.market-scroll {
  max-height: calc(100vh - 250rpx - var(--window-bottom, 0px));
}

.group-title {
  padding: 18rpx 8rpx 10rpx;
  color: #4d6ed8;
  font-size: 26rpx;
  font-weight: 900;
}

.market-swipe {
  position: relative;
  margin-bottom: 14rpx;
  border-radius: 18rpx;
  overflow: hidden;
}

.market-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  min-height: 116rpx;
  padding: 18rpx;
  border: 2rpx solid #cdd8fb;
  border-radius: 18rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f4f7ff 100%);
  box-shadow: 0 10rpx 22rpx rgba(52, 73, 140, 0.08);
  transition: transform 0.18s ease;
  will-change: transform;
}

.market-row.swiped {
  transform: translateX(-132rpx);
}

.market-row:active {
  background: #eef3ff;
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

.market-main {
  min-width: 0;
}

.market-name {
  overflow: hidden;
  color: #1f2f63;
  font-size: 30rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-meta {
  margin-top: 8rpx;
  color: #697597;
  font-size: 24rpx;
}

.debt-box {
  flex: 0 0 auto;
  min-width: 178rpx;
  text-align: right;
}

.debt-label {
  color: #697597;
  font-size: 22rpx;
  font-weight: 800;
}

.debt-money {
  margin-top: 4rpx;
  color: #4d6ed8;
  font-size: 30rpx;
  font-weight: 900;
}

.debt-box.clear .debt-money {
  color: #697597;
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
  box-shadow: 0 8rpx 20rpx rgba(52, 73, 140, 0.1);
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
  background: #e9eefb;
  color: #4d6ed8;
}

.empty,
.empty-state {
  color: #697597;
  text-align: center;
}

.empty-state {
  padding: 52rpx 20rpx;
}

.empty-title {
  color: #1f2f63;
  font-size: 30rpx;
  font-weight: 900;
}

.empty-text {
  margin-top: 8rpx;
  color: #697597;
  font-size: 24rpx;
}

.error {
  color: #d64b3f;
}
</style>
