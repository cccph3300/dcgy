<template>
  <view class="page supermarket-profit-page">
    <view class="profit-head">
      <view>
        <view class="head-label">东成果业</view>
        <view class="head-title">超市利润</view>
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
      <view class="summary-card">
        <text>总成本</text>
        <view>¥{{ money(summary.totalCost) }}</view>
      </view>
      <view class="summary-card">
        <text>总成本佣金</text>
        <view>¥{{ money(summary.totalCostCommission) }}</view>
      </view>
      <view class="summary-card">
        <text>总售卖佣金</text>
        <view>¥{{ money(summary.totalSaleCommission) }}</view>
      </view>
      <view class="summary-card profit">
        <text>总利润</text>
        <view>¥{{ money(summary.totalProfit) }}</view>
      </view>
    </view>

    <view v-if="loading" class="soft-card empty">正在计算超市利润...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <view v-else class="soft-card detail-card">
      <view class="section-title">超市利润明细</view>
      <view v-for="item in rows" :key="item.key" class="profit-row" @click="openOrder(item.id)">
        <view class="row-head">
          <view>
            <text class="market-name">{{ item.supermarketName }}</text>
            <text class="muted">{{ timeText(item.createdAt) }} · {{ item.itemCount }}个商品</text>
          </view>
          <view class="profit-money" :class="{ loss: Number(item.totalProfit || 0) < 0 }">¥{{ money(item.totalProfit) }}</view>
        </view>
        <view class="row-grid">
          <text>成本 ¥{{ money(item.totalCost) }}</text>
          <text>成佣 ¥{{ money(item.totalCostCommission) }}</text>
          <text>售佣 ¥{{ money(item.totalSaleCommission) }}</text>
          <text>总价 ¥{{ money(item.totalAmount) }}</text>
        </view>
      </view>
      <view v-if="!rows.length" class="empty">当前范围没有超市利润明细</view>
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
      summaryData: {
        totalCost: 0,
        totalCostCommission: 0,
        totalSaleCommission: 0,
        totalProfit: 0,
        orderCount: 0
      },
      rowsData: [],
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
    rows() {
      return this.rowsData
    }
  },
  onShow() {
    if (requireLogin()) this.loadProfit()
  },
  methods: {
    money,
    timeText,
    changeMode(event) {
      const option = this.modeOptions[Number(event.detail.value)]
      this.mode = option.value
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
    openOrder(id) {
      uni.navigateTo({ url: `/subpackages/delivery/detail?id=${id}&profit=1` })
    },
    async loadProfit() {
      this.loading = true
      this.error = ''
      try {
        const result = await request({
          url: `/api/supermarket-profit?mode=${encodeURIComponent(this.mode)}&day=${encodeURIComponent(this.day)}&startDate=${encodeURIComponent(this.startDate)}&endDate=${encodeURIComponent(this.endDate)}`
        })
        this.summaryData = result.summary || {
          totalCost: 0,
          totalCostCommission: 0,
          totalSaleCommission: 0,
          totalProfit: 0,
          orderCount: 0
        }
        this.rowsData = result.rows || []
      } catch (err) {
        this.summaryData = {
          totalCost: 0,
          totalCostCommission: 0,
          totalSaleCommission: 0,
          totalProfit: 0,
          orderCount: 0
        }
        this.rowsData = []
        this.error = err.message || '超市利润读取失败'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.supermarket-profit-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(77, 110, 216, 0.16), transparent 180rpx),
    radial-gradient(circle at 92% 10%, rgba(111, 88, 201, 0.12), transparent 220rpx),
    linear-gradient(180deg, #f6f8ff 0%, #eef3ff 100%);
}

.profit-head {
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

.refresh-button {
  width: 132rpx;
  height: 58rpx;
  min-height: 58rpx;
  border-radius: 16rpx;
  background: #e9eefb;
  color: #4d6ed8;
  font-size: 24rpx;
  font-weight: 900;
}

.filter-card,
.detail-card {
  border-color: #cdd8fb;
  background: linear-gradient(145deg, #ffffff 0%, #f4f7ff 100%);
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
  border: 1rpx solid #cdd8fb;
  border-radius: 12rpx;
  background: #f8faff;
  color: #1f2f63;
  font-weight: 900;
}

.range-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42rpx minmax(0, 1fr);
  gap: 10rpx;
  align-items: center;
}

.range-sep {
  color: #697597;
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
  border: 2rpx solid #cdd8fb;
  border-radius: 18rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f4f7ff 100%);
  box-shadow: 0 10rpx 22rpx rgba(52, 73, 140, 0.08);
}

.summary-card text {
  color: #697597;
  font-size: 24rpx;
  font-weight: 900;
}

.summary-card view {
  margin-top: 12rpx;
  color: #1f2f63;
  font-size: 32rpx;
  font-weight: 900;
}

.summary-card.profit view,
.profit-money {
  color: #4d6ed8;
}

.detail-card {
  padding: 18rpx;
}

.profit-row {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #e7ecfa;
}

.profit-row:active {
  background: #eef3ff;
}

.row-head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.market-name {
  display: block;
  overflow: hidden;
  color: #1f2f63;
  font-size: 28rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profit-money {
  flex-shrink: 0;
  font-size: 30rpx;
  font-weight: 900;
}

.row-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8rpx 16rpx;
  margin-top: 14rpx;
  color: #697597;
  font-size: 23rpx;
  font-weight: 800;
}

.loss {
  color: #d64b3f;
}

.empty {
  padding: 40rpx 0;
  color: #697597;
  text-align: center;
}

.error {
  color: #d64b3f;
}
</style>
