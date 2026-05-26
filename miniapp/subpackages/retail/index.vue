<template>
  <view class="page retail-home">
    <view class="hero">
      <view>
        <view class="eyebrow">东成果业</view>
        <view class="title">零售模块</view>
        <view class="subtitle">社区群商品、点单和记录单独管理</view>
      </view>
      <view class="hero-house">
        <view class="house-roof"></view>
        <view class="house-body">
          <view class="house-door"></view>
          <view class="house-window"></view>
        </view>
      </view>
    </view>

    <view class="action-grid">
      <view class="action-card upload" @click="open('/subpackages/retail/upload')">
        <view class="action-icon">传</view>
        <view class="action-copy">
          <view class="action-title">商品上传</view>
          <view class="action-desc">库存或代卖商品，带图片展示</view>
        </view>
        <view class="action-arrow">›</view>
      </view>
      <view class="action-card products" @click="open('/subpackages/retail/products')">
        <view class="action-icon">品</view>
        <view class="action-copy">
          <view class="action-title">商品列表</view>
          <view class="action-desc">上下架和编辑零售商品</view>
        </view>
        <view class="action-arrow">›</view>
      </view>
      <view class="action-card shop" @click="open('/subpackages/retail/shop?staff=1')">
        <view class="action-icon">客</view>
        <view class="action-copy">
          <view class="action-title">客户页</view>
          <view class="action-desc">查看客户公开商品页并分享</view>
        </view>
        <view class="action-arrow">›</view>
      </view>
      <view class="action-card order" @click="open('/subpackages/retail/order')">
        <view class="action-icon">单</view>
        <view class="action-copy">
          <view class="action-title">零售点单</view>
          <view class="action-desc">客户私下点单，不接打印</view>
        </view>
        <view class="action-arrow">›</view>
      </view>
      <view class="action-card records" @click="open('/subpackages/retail/records')">
        <view class="action-icon">记</view>
        <view class="action-copy">
          <view class="action-title">零售记录</view>
          <view class="action-desc">按时间和客户筛选记录</view>
        </view>
        <view class="action-arrow">›</view>
      </view>
      <view class="action-card profit" @click="open('/subpackages/retail/profit')">
        <view class="action-icon">利</view>
        <view class="action-copy">
          <view class="action-title">零售利润</view>
          <view class="action-desc">按商品和订单查看利润</view>
        </view>
        <view class="action-arrow">›</view>
      </view>
    </view>

    <view class="soft-card note-card">
      <view class="section-title">零售说明</view>
      <view class="rule-row">库存商品：出单后按件数扣库存</view>
      <view class="rule-row">代卖商品：只记销售，不扣库存</view>
      <view class="rule-row">客户公开页：只看商品，不进入后台</view>
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
    open(url) {
      uni.navigateTo({ url })
    }
  }
}
</script>

<style scoped>
.retail-home {
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

.hero-house {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  border-radius: 28rpx;
  background: linear-gradient(145deg, #15a86b 0%, #0f7a54 100%);
  box-shadow: 0 12rpx 24rpx rgba(22, 148, 95, 0.18);
}

.house-roof {
  position: absolute;
  top: 22rpx;
  width: 48rpx;
  height: 48rpx;
  border-top: 8rpx solid #ffffff;
  border-left: 8rpx solid #ffffff;
  transform: rotate(45deg);
}

.house-body {
  position: absolute;
  bottom: 20rpx;
  width: 54rpx;
  height: 40rpx;
  border: 7rpx solid #ffffff;
  border-top: 0;
  border-radius: 0 0 8rpx 8rpx;
}

.house-door {
  position: absolute;
  left: 9rpx;
  bottom: 0;
  width: 13rpx;
  height: 24rpx;
  border-radius: 5rpx 5rpx 0 0;
  background: #ffffff;
}

.house-window {
  position: absolute;
  right: 8rpx;
  top: 10rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 4rpx;
  background: #ffffff;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.action-card {
  position: relative;
  display: grid;
  grid-template-columns: 64rpx minmax(0, 1fr);
  gap: 16rpx;
  align-items: center;
  min-height: 154rpx;
  padding: 18rpx;
  border: 2rpx solid #d7ead9;
  border-radius: 22rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f0faef 100%);
  box-shadow: 0 10rpx 24rpx rgba(25, 55, 44, 0.07);
}

.products {
  background: linear-gradient(145deg, #ffffff 0%, #fff9e8 100%);
}

.shop {
  background: linear-gradient(145deg, #ffffff 0%, #fff0ef 100%);
}

.order {
  background: linear-gradient(145deg, #ffffff 0%, #edf6ff 100%);
  border-color: #cfe3f7;
}

.records {
  background: linear-gradient(145deg, #ffffff 0%, #f0edff 100%);
  border-color: #ddd6ff;
}

.profit {
  background: linear-gradient(145deg, #ffffff 0%, #fff2df 100%);
  border-color: #f6dfbd;
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62rpx;
  height: 62rpx;
  border-radius: 20rpx;
  background: #16945f;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 900;
}

.products .action-icon {
  background: #ffbf3f;
  color: #17362f;
}

.shop .action-icon {
  background: #ef6f5e;
}

.order .action-icon {
  background: #2e7fc7;
}

.records .action-icon {
  background: #7661d8;
}

.profit .action-icon {
  background: #d78925;
}

.action-copy {
  min-width: 0;
}

.action-title {
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
}

.action-arrow {
  position: absolute;
  right: 16rpx;
  top: 16rpx;
  color: rgba(23, 54, 47, 0.26);
  font-size: 38rpx;
  font-weight: 900;
}

.action-desc,
.rule-row {
  margin-top: 8rpx;
  color: #718078;
  font-size: 22rpx;
  line-height: 1.45;
}

.retail-home {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(11, 154, 135, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f2fffb 0%, #e7fbf6 100%);
}

.eyebrow,
.section-title {
  color: #0b9a87;
}

.title,
.action-title {
  color: #0d4d45;
}

.action-card,
.note-card {
  border-color: #bde5df;
  background: linear-gradient(145deg, #ffffff 0%, #effdfa 100%);
}

.action-icon {
  background: #0b9a87;
}

.action-desc,
.rule-row {
  color: #587d78;
}
</style>
