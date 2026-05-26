<script>
import { TCB_ENV_ID } from './config/api'
import { getToken } from './utils/request'

export default {
  onLaunch() {
    // 微信小程序端通过云开发 AnyService 转发到临时公网 HTTP 服务。
    // 这里只初始化云开发环境，H5/APP 不受影响。
    // #ifdef MP-WEIXIN
    if (TCB_ENV_ID && wx?.cloud?.init) {
      wx.cloud.init({
        env: TCB_ENV_ID,
        traceUser: true
      })
    }
    // #endif

    // APP 原生 tabBar 会按 pages 与 tabBar 的顺序建立页面映射。
    // 冷启动时进入第一个 tab，避免 reLaunch 到非首个 tab 导致 APK 里 tab 选中态错位。
    // #ifdef APP-PLUS
    if (getToken()) {
      setTimeout(() => {
        uni.switchTab({ url: '/pages/order/index' })
      }, 0)
    } else {
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/login/index' })
      }, 0)
    }
    // #endif
  }
}
</script>

<style>
page {
  min-height: 100%;
  background: #f6f8ef;
  background:
    radial-gradient(circle at 8% 4%, rgba(255, 191, 63, 0.16), transparent 150rpx),
    radial-gradient(circle at 94% 12%, rgba(22, 148, 95, 0.12), transparent 180rpx),
    linear-gradient(180deg, #f8fbf2 0%, #eef7ed 100%);
  color: #17362f;
  font-size: 28rpx;
}

view,
text,
input,
button {
  box-sizing: border-box;
}

button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  border: 0;
  padding: 0;
  line-height: 1.2;
}

button::after {
  display: none;
  border: 0;
}

.page {
  padding: 18rpx;
}

.soft-card {
  margin-bottom: 18rpx;
  padding: 20rpx;
  border: 1rpx solid #dfe8d8;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 24rpx rgba(25, 55, 44, 0.08);
}

.input {
  min-height: 68rpx;
  padding: 0 18rpx;
  border: 1rpx solid #dce8da;
  border-radius: 12rpx;
  background: #f8fbf4;
  color: #17362f;
}

.soft-button {
  min-height: 68rpx;
  padding: 0 22rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1;
  text-align: center;
}

.primary {
  background: linear-gradient(135deg, #16a66c 0%, #0f7d55 100%);
  color: #ffffff;
  box-shadow: 0 8rpx 18rpx rgba(22, 148, 95, 0.22);
}

.success {
  color: #16945f;
}

.danger {
  color: #e85d4f;
}

.muted {
  color: #748078;
  font-size: 24rpx;
}

.section-title {
  margin-bottom: 14rpx;
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
}
</style>
