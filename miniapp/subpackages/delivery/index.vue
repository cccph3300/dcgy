<template>
  <view class="page delivery-home">
    <view class="hero">
      <view>
        <view class="eyebrow">东成果业</view>
        <view class="title">超市配送</view>
        <view class="subtitle">送货单、结算和利润单独管理</view>
      </view>
      <view class="hero-mark">配</view>
    </view>

    <view class="action-grid">
      <view class="action-card create" @click="openCreate">
        <view class="action-icon">新</view>
        <view class="action-title">新建送货单</view>
        <view class="action-desc">录入自家商品和代采购商品</view>
      </view>
      <view class="action-card list" @click="openList">
        <view class="action-icon">单</view>
        <view class="action-title">查看超市订单</view>
        <view class="action-desc">按日期、超市和状态查看</view>
      </view>
      <view class="action-card ocr" @click="openOcr">
        <view class="action-icon">识</view>
        <view class="action-title">文本识别送货单</view>
        <view class="action-desc">拍照或粘贴文本后自动识别</view>
      </view>
      <view class="action-card trash" @click="openRecycle">
        <view class="action-icon">收</view>
        <view class="action-title">超市订单回收站</view>
        <view class="action-desc">查看和恢复作废配送单</view>
      </view>
    </view>

    <view class="soft-card note-card">
      <view class="section-title">计价规则</view>
      <view class="rule-row">有重量：重量 × 价格 + 佣金</view>
      <view class="rule-row">无重量：数量 × 价格 + 佣金</view>
      <view class="rule-row">自家商品：按填写件数扣库存</view>
    </view>
  </view>
</template>

<script>
import { requireLogin } from '../../utils/request'

export default {
  onShow() {
    requireLogin()
  },
  methods: {
    openCreate() {
      uni.navigateTo({ url: '/subpackages/delivery/create' })
    },
    openList() {
      uni.navigateTo({ url: '/subpackages/delivery/list' })
    },
    openRecycle() {
      uni.navigateTo({ url: '/subpackages/delivery/recycle' })
    },
    openOcr() {
      uni.navigateTo({ url: '/subpackages/delivery/ocr' })
    },
    showTodo(name) {
      uni.showToast({ title: `${name}暂未开放`, icon: 'none' })
    }
  }
}
</script>

<style scoped>
.delivery-home {
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 8rpx 18rpx;
}

.eyebrow {
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
}

.title {
  margin-top: 8rpx;
  color: #17362f;
  font-size: 44rpx;
  font-weight: 900;
}

.subtitle {
  margin-top: 6rpx;
  color: #718078;
  font-size: 24rpx;
}

.hero-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  border-radius: 28rpx;
  background: #16945f;
  color: #ffffff;
  font-size: 42rpx;
  font-weight: 900;
  box-shadow: 0 12rpx 24rpx rgba(22, 148, 95, 0.18);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.action-card {
  min-height: 210rpx;
  padding: 22rpx;
  border: 2rpx solid #d7ead9;
  border-radius: 20rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f0faef 100%);
  box-shadow: 0 12rpx 26rpx rgba(25, 55, 44, 0.08);
}

.action-card.list,
.action-card.trash {
  margin-top: 36rpx;
  background: linear-gradient(145deg, #ffffff 0%, #fff9e8 100%);
}

.action-card.ocr {
  background: linear-gradient(145deg, #ffffff 0%, #eef7ff 100%);
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62rpx;
  height: 62rpx;
  border-radius: 18rpx;
  background: #16945f;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 900;
}

.list .action-icon {
  background: #ffbf3f;
  color: #17362f;
}

.action-title {
  margin-top: 22rpx;
  color: #17362f;
  font-size: 32rpx;
  font-weight: 900;
}

.action-desc,
.rule-row {
  margin-top: 8rpx;
  color: #718078;
  font-size: 24rpx;
  line-height: 1.45;
}

.note-card {
  background: #fffef9;
}
</style>
