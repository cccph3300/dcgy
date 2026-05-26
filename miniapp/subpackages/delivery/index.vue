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
  min-height: 100vh;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 12% 4%, rgba(77, 110, 216, 0.16), transparent 180rpx),
    radial-gradient(circle at 92% 10%, rgba(111, 88, 201, 0.12), transparent 220rpx),
    linear-gradient(180deg, #f6f8ff 0%, #eef3ff 100%);
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 8rpx 18rpx;
}

.eyebrow {
  color: #4d6ed8;
  font-size: 24rpx;
  font-weight: 900;
}

.title {
  margin-top: 8rpx;
  color: #1f2f63;
  font-size: 44rpx;
  font-weight: 900;
}

.subtitle {
  margin-top: 6rpx;
  color: #697597;
  font-size: 24rpx;
}

.hero-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  border-radius: 28rpx;
  background: linear-gradient(145deg, #4d6ed8 0%, #6f58c9 100%);
  color: #ffffff;
  font-size: 42rpx;
  font-weight: 900;
  box-shadow: 0 12rpx 24rpx rgba(77, 110, 216, 0.26);
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
  border: 2rpx solid #cdd8fb;
  border-radius: 20rpx;
  background: linear-gradient(145deg, #ffffff 0%, #edf2ff 100%);
  box-shadow: 0 12rpx 26rpx rgba(52, 73, 140, 0.1);
}

.action-card.list,
.action-card.trash {
  margin-top: 36rpx;
  border-color: #e2d4ff;
  background: linear-gradient(145deg, #ffffff 0%, #f3efff 100%);
}

.action-card.ocr {
  border-color: #c9dff7;
  background: linear-gradient(145deg, #ffffff 0%, #eaf6ff 100%);
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62rpx;
  height: 62rpx;
  border-radius: 18rpx;
  background: #4d6ed8;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 900;
}

.list .action-icon {
  background: #6f58c9;
  color: #ffffff;
}

.ocr .action-icon {
  background: #2f7fc1;
}

.trash .action-icon {
  background: #47618f;
}

.action-title {
  margin-top: 22rpx;
  color: #1f2f63;
  font-size: 32rpx;
  font-weight: 900;
}

.action-desc,
.rule-row {
  margin-top: 8rpx;
  color: #697597;
  font-size: 24rpx;
  line-height: 1.45;
}

.note-card {
  border-color: #cdd8fb;
  background: linear-gradient(145deg, #ffffff 0%, #f1f5ff 100%);
}

.note-card .section-title {
  color: #1f2f63;
}
</style>
