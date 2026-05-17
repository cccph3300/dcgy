<template>
  <view class="page more-page">
    <view class="header">
      <view class="eyebrow">东成果业</view>
      <view class="title">其他功能</view>
      <view class="subtitle">库存、回收、配送和利润都在这里</view>
    </view>

    <view class="module-section">
      <view class="section-head">
        <view class="section-title">批发模块</view>
        <view class="section-note">点单、库存和批发经营</view>
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
    </view>

    <view class="module-section retail-section">
      <view class="section-head">
        <view class="section-title">零售模块</view>
        <view class="section-note">社区群商品和零售点单</view>
      </view>
      <view
        class="module-card retail-card"
        @click="openModule(retailModule.url)"
      >
        <view class="module-icon retail-icon"></view>
        <view class="module-title">{{ retailModule.title }}</view>
        <view class="module-desc">{{ retailModule.desc }}</view>
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
      retailModule: {
        title: '零售',
        desc: '商品上传、商品列表、零售点单和记录',
        url: '/subpackages/retail/index'
      },
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
          title: '订单改单',
          desc: '按日期查找并修改批发订单',
          url: '/subpackages/other/orders/fix',
          className: 'orders-fix',
          iconClass: 'orders-fix-icon'
        },
        {
          title: '漏单加单',
          desc: '补录遗漏的批发订单',
          url: '/subpackages/other/orders/add',
          className: 'orders-add',
          iconClass: 'orders-add-icon'
        },
        {
          title: '客户列表',
          desc: '查看客户和总欠账',
          url: '/subpackages/other/customers/index',
          className: 'customers',
          iconClass: 'customers-icon'
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

.module-section {
  margin-top: 18rpx;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 4rpx 12rpx;
}

.section-title {
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
}

.section-note {
  color: #718078;
  font-size: 22rpx;
  font-weight: 800;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  align-content: start;
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
  border-color: #dcd4f5;
  background: linear-gradient(145deg, #ffffff 0%, #f2efff 100%);
}

.delivery-icon {
  background: #6f58c9;
}

.profit {
  background: linear-gradient(145deg, #ffffff 0%, #fff9e8 100%);
}

.prints {
  background: linear-gradient(145deg, #ffffff 0%, #eef7ff 100%);
}

.customers {
  border-color: #cfe3f2;
  background: linear-gradient(145deg, #ffffff 0%, #edf7ff 100%);
}

.orders-fix {
  border-color: #f2dcc0;
  background: linear-gradient(145deg, #ffffff 0%, #fff3e0 100%);
}

.orders-fix-icon {
  background: #d97817;
}

.orders-fix-icon::before {
  left: 15rpx;
  top: 14rpx;
  width: 32rpx;
  height: 36rpx;
  border: 5rpx solid #ffffff;
  border-radius: 6rpx;
}

.orders-fix-icon::after {
  left: 24rpx;
  top: 24rpx;
  width: 25rpx;
  height: 6rpx;
  border-radius: 6rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 0 #ffffff;
}

.orders-add {
  border-color: #cfe9da;
  background: linear-gradient(145deg, #ffffff 0%, #eaf8ef 100%);
}

.orders-add-icon {
  background: #16945f;
}

.orders-add-icon::before {
  left: 15rpx;
  top: 14rpx;
  width: 32rpx;
  height: 36rpx;
  border: 5rpx solid #ffffff;
  border-radius: 6rpx;
}

.orders-add-icon::after {
  left: 27rpx;
  top: 23rpx;
  width: 8rpx;
  height: 24rpx;
  border-radius: 6rpx;
  background: #ffffff;
  box-shadow: -8rpx 8rpx 0 -2rpx #ffffff, 8rpx -8rpx 0 -2rpx #ffffff;
}

.customers-icon {
  background: #2f6f9f;
}

.customers-icon::before {
  left: 12rpx;
  top: 15rpx;
  width: 20rpx;
  height: 20rpx;
  border: 5rpx solid #ffffff;
  border-radius: 50%;
}

.customers-icon::after {
  left: 9rpx;
  top: 38rpx;
  width: 27rpx;
  height: 15rpx;
  border: 5rpx solid #ffffff;
  border-bottom: 0;
  border-radius: 18rpx 18rpx 0 0;
  box-shadow: 23rpx -18rpx 0 -6rpx #ffffff, 28rpx 2rpx 0 -6rpx #ffffff;
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

.retail-section {
  padding-top: 8rpx;
}

.retail-card {
  min-height: 178rpx;
  background: linear-gradient(145deg, #ffffff 0%, #e9f8ef 100%);
}

.retail-icon {
  background: #16945f;
}

.retail-icon::before {
  left: 15rpx;
  top: 16rpx;
  width: 32rpx;
  height: 32rpx;
  border: 5rpx solid #ffffff;
  border-radius: 50%;
}

.retail-icon::after {
  left: 29rpx;
  top: 13rpx;
  width: 12rpx;
  height: 20rpx;
  border-radius: 12rpx 0 12rpx 0;
  background: #d9f5e6;
  transform: rotate(35deg);
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
