<template>
  <view class="page more-page">
    <view class="header">
      <view class="eyebrow">东成果业</view>
      <view class="title">其他功能</view>
      <view class="subtitle">库存、回收、配送和利润都在这里</view>
    </view>

    <view class="module-grid">
      <view
        v-for="item in modules"
        :key="item.title"
        class="module-card"
        :class="item.className"
        @click="openModule(item.url)"
      >
        <view class="module-icon" :class="item.iconClass"></view>
        <view class="module-title">{{ item.title }}</view>
        <view class="module-desc">{{ item.desc }}</view>
      </view>
    </view>

    <view class="logout-footer">
      <button class="soft-button logout-button" @click="logout">退出登录</button>
    </view>
  </view>
</template>

<script>
import { clearSession, requireLogin } from '../../utils/request'

export default {
  data() {
    return {
      modules: [
        {
          title: '库存',
          desc: '货物入库与库存管理',
          url: '/subpackages/other/inventory/list',
          className: 'inventory',
          iconClass: 'inventory-icon'
        },
        {
          title: '回收站',
          desc: '查看已删除或停用数据',
          url: '/subpackages/other/recycle/index',
          className: 'recycle',
          iconClass: 'recycle-icon'
        },
        {
          title: '超市配送',
          desc: '配送订单和门店记录',
          url: '/subpackages/delivery/index',
          className: 'delivery',
          iconClass: 'delivery-icon'
        },
        {
          title: '利润',
          desc: '收入、成本和佣金统计',
          url: '/subpackages/other/profit/index',
          className: 'profit',
          iconClass: 'profit-icon'
        },
        {
          title: '打印记录',
          desc: '查看、重打和删除打印记录',
          url: '/subpackages/other/prints/index',
          className: 'prints',
          iconClass: 'prints-icon'
        }
      ]
    }
  },
  onShow() {
    requireLogin()
  },
  methods: {
    openModule(url) {
      uni.navigateTo({
        url,
        fail: (err) => {
          uni.showToast({ title: err.errMsg || '页面打开失败', icon: 'none' })
        }
      })
    },
    logout() {
      uni.showModal({
        title: '退出登录',
        content: '确定要退出当前账号吗？',
        confirmText: '退出',
        cancelText: '取消',
        success: (res) => {
          if (!res.confirm) return
          clearSession()
          uni.reLaunch({ url: '/pages/login/index' })
        }
      })
    }
  }
}
</script>

<style scoped>
.more-page {
  display: flex;
  flex-direction: column;
  padding-bottom: calc(28rpx + env(safe-area-inset-bottom));
}

.header {
  flex: none;
  padding: 18rpx 8rpx 8rpx;
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

.subtitle {
  margin-top: 6rpx;
  color: #718078;
  font-size: 24rpx;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  flex: 1;
  align-content: start;
  padding-top: 16rpx;
}

.module-card {
  min-height: 190rpx;
  padding: 22rpx;
  border: 2rpx solid #d7ead9;
  border-radius: 20rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f0faef 100%);
  box-shadow: 0 12rpx 26rpx rgba(25, 55, 44, 0.08);
}



.module-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 62rpx;
  height: 62rpx;
  border-radius: 18rpx;
  background: #16945f;
  overflow: hidden;
}

.module-icon::before,
.module-icon::after {
  position: absolute;
  box-sizing: border-box;
  content: "";
}

.inventory-icon::before {
  left: 13rpx;
  top: 23rpx;
  width: 36rpx;
  height: 24rpx;
  border: 5rpx solid #ffffff;
  border-top: 0;
  border-radius: 4rpx;
}

.inventory-icon::after {
  left: 11rpx;
  top: 15rpx;
  width: 40rpx;
  height: 20rpx;
  border-left: 5rpx solid #ffffff;
  border-top: 5rpx solid #ffffff;
  transform: skewX(-24deg);
}

.recycle-icon::before {
  left: 17rpx;
  top: 21rpx;
  width: 28rpx;
  height: 28rpx;
  border: 5rpx solid #ffffff;
  border-top: 0;
  border-radius: 0 0 6rpx 6rpx;
}

.recycle-icon::after {
  left: 14rpx;
  top: 13rpx;
  width: 34rpx;
  height: 11rpx;
  border-top: 5rpx solid #ffffff;
  border-radius: 6rpx;
  box-shadow: 11rpx -5rpx 0 -7rpx #ffffff;
}

.delivery-icon::before {
  left: 12rpx;
  top: 19rpx;
  width: 34rpx;
  height: 22rpx;
  border: 5rpx solid #ffffff;
  border-top: 0;
  border-radius: 0 0 6rpx 6rpx;
}

.delivery-icon::after {
  left: 16rpx;
  top: 44rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 22rpx 0 0 #ffffff;
}

.profit-icon {
  background: #ffbf3f;
}

.profit-icon::before {
  left: 13rpx;
  top: 15rpx;
  width: 36rpx;
  height: 32rpx;
  border: 5rpx solid #17362f;
  border-radius: 50%;
}

.profit-icon::after {
  left: 28rpx;
  top: 19rpx;
  width: 6rpx;
  height: 24rpx;
  border-radius: 4rpx;
  background: #17362f;
  box-shadow: -8rpx 8rpx 0 -2rpx #17362f, 8rpx -8rpx 0 -2rpx #17362f;
}

.module-title {
  margin-top: 22rpx;
  color: #17362f;
  font-size: 34rpx;
  font-weight: 900;
}

.module-desc {
  margin-top: 8rpx;
  color: #718078;
  font-size: 23rpx;
  line-height: 1.4;
}

.recycle {
  background: linear-gradient(145deg, #ffffff 0%, #f8fbf2 100%);
}

.delivery {
  background: linear-gradient(145deg, #ffffff 0%, #eef9f3 100%);
}

.profit {
  background: linear-gradient(145deg, #ffffff 0%, #fff9e8 100%);
}

.prints {
  background: linear-gradient(145deg, #ffffff 0%, #eef7ff 100%);
}

.prints-icon {
  background: #245277;
}

.prints-icon::before {
  left: 15rpx;
  top: 16rpx;
  width: 32rpx;
  height: 18rpx;
  border: 5rpx solid #ffffff;
  border-radius: 4rpx 4rpx 0 0;
}

.prints-icon::after {
  left: 11rpx;
  top: 31rpx;
  width: 40rpx;
  height: 22rpx;
  border: 5rpx solid #ffffff;
  border-radius: 5rpx;
  box-shadow: 9rpx 11rpx 0 -6rpx #ffffff;
}

.logout-footer {
  display: flex;
  flex: none;
  justify-content: center;
  padding-top: 28rpx;
}

.logout-button {
  width: 220rpx;
  height: 64rpx;
  min-height: 64rpx;
  background: #fff6cf;
  color: #17362f;
  font-size: 26rpx;
}
</style>
