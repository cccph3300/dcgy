<template>
  <view class="page retail-profit">
    <view class="profit-head">
      <view>
        <view class="head-label">零售模块</view>
        <view class="head-title">零售利润</view>
      </view>
      <button class="refresh-button" :disabled="loading" @click="loadProfit">{{ loading ? '读取中' : '刷新' }}</button>
    </view>

    <view class="soft-card filter-card">
      <picker :value="modeIndex" :range="modeOptions" range-key="label" @change="changeMode">
        <view class="input picker-input">{{ modeLabel }}</view>
      </picker>
      <picker v-if="mode === 'day'" mode="date" :value="day" @change="changeDay">
        <view class="date-button">选择日期：{{ day }}</view>
      </picker>
      <view v-if="mode === 'range'" class="range-row">
        <picker mode="date" :value="startDate" @change="changeStartDate">
          <view class="date-button">{{ startDate }}</view>
        </picker>
        <text class="range-sep">至</text>
        <picker mode="date" :value="endDate" @change="changeEndDate">
          <view class="date-button">{{ endDate }}</view>
        </picker>
      </view>
    </view>

    <view class="summary-grid">
      <view class="summary-card sales">
        <text>销售金额</text>
        <view>¥{{ money(summary.sales) }}</view>
      </view>
      <view class="summary-card profit">
        <text>利润</text>
        <view>¥{{ money(summary.profit) }}</view>
      </view>
      <view class="summary-card cost">
        <text>成本</text>
        <view>¥{{ money(summary.cost) }}</view>
      </view>
      <view class="summary-card count">
        <text>订单</text>
        <view>{{ summary.orderCount }}单</view>
      </view>
    </view>

    <view v-if="loading" class="soft-card empty">正在计算零售利润...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>
    <view v-else class="soft-card detail-card">
      <view class="detail-tabs">
        <button class="tab-button" :class="{ active: detailMode === 'goods' }" @click="detailMode = 'goods'">商品利润明细</button>
        <button class="tab-button" :class="{ active: detailMode === 'orders' }" @click="detailMode = 'orders'">订单利润明细</button>
      </view>

      <template v-if="detailMode === 'goods'">
        <view v-for="item in goodsRows" :key="item.key" class="profit-row">
          <view class="row-main">
            <text class="goods-name">{{ item.goodsName }}</text>
            <text class="muted">{{ item.categoryText }} · {{ item.quantityText }} · 成本¥{{ money(item.costAmount) }}</text>
          </view>
          <view class="row-money">
            <text>售¥{{ money(item.salesAmount) }}</text>
            <text :class="{ loss: Number(item.profitAmount) < 0 }">利¥{{ money(item.profitAmount) }}</text>
          </view>
        </view>
        <view v-if="!goodsRows.length" class="empty">当前范围没有零售订单</view>
      </template>

      <template v-else>
        <view v-for="item in orderRows" :key="item.key" class="profit-row order-profit-row" @click="openOrderProfit(item.id)">
          <view class="row-main">
            <text class="goods-name">{{ item.name }}</text>
            <text class="muted">{{ item.typeText }} · {{ item.time }}</text>
          </view>
          <view class="row-money">
            <text>售¥{{ money(item.salesAmount) }}</text>
            <text :class="{ loss: Number(item.profitAmount) < 0 }">利¥{{ money(item.profitAmount) }}</text>
          </view>
        </view>
        <view v-if="!orderRows.length" class="empty">当前范围没有订单利润明细</view>
      </template>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money, timeText, todayText } from '../../utils/format'

const today = todayText()

export default {
  data() {
    return {
      mode: 'day',
      day: today,
      startDate: today,
      endDate: today,
      modeOptions: [
        { label: '当日', value: 'day' },
        { label: '全部日期', value: 'all' },
        { label: '日期范围', value: 'range' },
        { label: '当月', value: 'month' }
      ],
      summaryData: { sales: 0, profit: 0, cost: 0, orderCount: 0 },
      goodsRowsData: [],
      orderRowsData: [],
      detailMode: 'goods',
      loading: false,
      error: ''
    }
  },
  computed: {
    modeIndex() {
      const index = this.modeOptions.findIndex(item => item.value === this.mode)
      return index < 0 ? 0 : index
    },
    modeLabel() {
      return this.modeOptions[this.modeIndex].label
    },
    summary() {
      return this.summaryData
    },
    goodsRows() {
      return this.goodsRowsData
    },
    orderRows() {
      return this.orderRowsData.map(row => ({ ...row, time: timeText(row.createdAt) }))
    }
  },
  onShow() {
    if (requireLogin()) this.loadProfit()
  },
  methods: {
    money,
    changeMode(event) {
      this.mode = this.modeOptions[Number(event.detail.value)].value
      this.loadProfit()
    },
    changeDay(event) {
      this.day = event.detail.value
      this.loadProfit()
    },
    changeStartDate(event) {
      this.startDate = event.detail.value
      if (this.startDate > this.endDate) this.endDate = this.startDate
      this.loadProfit()
    },
    changeEndDate(event) {
      this.endDate = event.detail.value
      if (this.endDate < this.startDate) this.startDate = this.endDate
      this.loadProfit()
    },
    openOrderProfit(id) {
      uni.navigateTo({ url: `/subpackages/retail/detail?id=${id}&profit=1` })
    },
    async loadProfit() {
      this.loading = true
      this.error = ''
      try {
        const result = await request({
          url: `/api/retail/profit?mode=${encodeURIComponent(this.mode)}&day=${encodeURIComponent(this.day)}&startDate=${encodeURIComponent(this.startDate)}&endDate=${encodeURIComponent(this.endDate)}`
        })
        this.summaryData = result.summary || { sales: 0, profit: 0, cost: 0, orderCount: 0 }
        this.goodsRowsData = result.goodsRows || []
        this.orderRowsData = result.orderRows || []
      } catch (err) {
        this.summaryData = { sales: 0, profit: 0, cost: 0, orderCount: 0 }
        this.goodsRowsData = []
        this.orderRowsData = []
        this.error = err.message || '零售利润读取失败'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.profit-head {
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

.refresh-button {
  width: 132rpx;
  height: 58rpx;
  min-height: 58rpx;
  border-radius: 16rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 24rpx;
  font-weight: 900;
}

.filter-card {
  display: grid;
  gap: 12rpx;
  padding: 16rpx;
}

.picker-input,
.date-button {
  display: flex;
  align-items: center;
  min-height: 64rpx;
}

.date-button {
  padding: 0 18rpx;
  border: 1rpx solid #dce8da;
  border-radius: 12rpx;
  background: #f8fbf4;
  color: #17362f;
  font-weight: 900;
}

.range-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42rpx minmax(0, 1fr);
  gap: 10rpx;
  align-items: center;
}

.range-sep {
  color: #718078;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.summary-card {
  min-height: 126rpx;
  padding: 18rpx;
  border: 2rpx solid #d7ead9;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(25, 55, 44, 0.07);
}

.summary-card text {
  color: #718078;
  font-size: 24rpx;
  font-weight: 900;
}

.summary-card view {
  margin-top: 12rpx;
  color: #17362f;
  font-size: 34rpx;
  font-weight: 900;
}

.summary-card.sales,
.summary-card.profit {
  background: linear-gradient(145deg, #ffffff 0%, #eef9f3 100%);
}

.summary-card.profit view {
  color: #16945f;
}

.summary-card.cost {
  background: linear-gradient(145deg, #ffffff 0%, #fff9e8 100%);
}

.detail-card {
  padding: 18rpx;
}

.detail-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.tab-button {
  height: 64rpx;
  min-height: 64rpx;
  border-radius: 14rpx;
  background: #edf2eb;
  color: #718078;
  font-size: 26rpx;
  font-weight: 900;
}

.tab-button.active {
  background: #16945f;
  color: #ffffff;
}

.profit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12rpx;
  align-items: center;
  min-height: 76rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #eef2ee;
}

.order-profit-row {
  border-radius: 14rpx;
  padding: 14rpx 10rpx;
}

.order-profit-row:active {
  background: #f2fbf4;
}

.row-main {
  min-width: 0;
}

.goods-name {
  display: block;
  overflow: hidden;
  color: #17362f;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-money {
  display: grid;
  gap: 4rpx;
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
  text-align: right;
}

.row-money .loss {
  color: #d64b3f;
}

.empty {
  padding: 40rpx 0;
  color: #718078;
  text-align: center;
}

.error {
  color: #d64b3f;
}

.retail-profit {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(11, 154, 135, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f2fffb 0%, #e7fbf6 100%);
}

.soft-card,
.filter-card,
.summary-card,
.chart-card,
.list-card {
  border-color: #bde5df;
  background: linear-gradient(145deg, #ffffff 0%, #effdfa 100%);
}

.section-title,
.goods-name {
  color: #0d4d45;
}

.row-money,
.date-change,
.summary-value {
  color: #0b9a87;
}

.date-change,
.tab.active {
  background: #dff6f1;
}

.primary {
  background: #0b9a87;
}
</style>
