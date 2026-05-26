<template>
  <view class="page login-page">
    <view class="soft-card login-card">
      <view class="brand-row">
        <image class="brand-logo" src="/static/app-icons/icon-192.png" mode="aspectFill"></image>
        <view class="brand-name">{{ text.brand }}</view>
      </view>
      <view class="section-title">{{ text.title }}</view>
      <view class="field-row">
        <text class="field-label">{{ text.user }}</text>
        <input v-model="username" class="input" :placeholder="text.userPlaceholder" @input="clearLoginError" />
      </view>
      <view class="field-row">
        <text class="field-label">{{ text.password }}</text>
        <input v-model="password" class="input" password :placeholder="text.passwordPlaceholder" @input="clearLoginError" @confirm="login" />
      </view>
      <view v-if="loginError" class="login-error">{{ loginError }}</view>
      <button class="soft-button primary" :disabled="loading" @click="login">
        {{ loading ? text.loggingIn : text.login }}
      </button>
    </view>
  </view>
</template>

<script>
import { clearSession, getToken, request, setSession } from '../../utils/request'

const zh = {
  brand: '\u4e1c\u6210\u679c\u4e1a',
  title: '\u5e97\u5458\u767b\u5f55',
  user: '\u7528\u6237',
  password: '\u5bc6\u7801',
  userPlaceholder: '\u8bf7\u8f93\u5165\u8d26\u53f7',
  passwordPlaceholder: '\u8bf7\u8f93\u5165\u5bc6\u7801',
  login: '\u767b\u5f55',
  loggingIn: '\u767b\u5f55\u4e2d...',
  missing: '\u8bf7\u8f93\u5165\u8d26\u53f7\u548c\u5bc6\u7801',
  invalid: '\u8d26\u53f7\u6216\u5bc6\u7801\u4e0d\u6b63\u786e'
}

export default {
  data() {
    return {
      text: zh,
      username: '',
      password: '',
      loading: false,
      loginError: '',
      checkingSession: false
    }
  },
  async onShow() {
    if (!getToken() || this.checkingSession) return
    this.checkingSession = true
    // APP 冷启动可能先显示登录页；有本地 token 时先进入第一个 tab，避免网络校验期间误以为需要重新登录。
    // 服务端会在后续业务接口返回 401 时统一要求重新登录。
    // #ifdef APP-PLUS
    uni.switchTab({ url: '/pages/order/index' })
    this.checkingSession = false
    return
    // #endif

    try {
      const data = await request({ url: '/api/auth/me', showErrorToast: false })
      if (data.staff) {
        uni.switchTab({ url: '/pages/order/index' })
      } else {
        clearSession()
      }
    } finally {
      this.checkingSession = false
    }
  },
  methods: {
    clearLoginError() {
      this.loginError = ''
    },
    async login() {
      this.loginError = ''
      if (!this.username || !this.password) {
        this.loginError = this.text.missing
        return
      }

      this.loading = true
      try {
        const data = await request({
          url: '/api/auth/login',
          method: 'POST',
          data: {
            username: this.username,
            password: this.password
          },
          auth: false,
          showErrorToast: false
        })
        setSession(data.token, data.staff || data)
        uni.switchTab({ url: '/pages/order/index' })
      } catch (err) {
        this.loginError = err?.message || this.text.invalid
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - var(--window-top, 0px) - var(--window-bottom, 0px));
  padding: 32rpx;
  box-sizing: border-box;
}

.login-card {
  position: relative;
  width: 100%;
  max-width: 620rpx;
  padding: 34rpx 26rpx;
  overflow: hidden;
}

.login-card::before {
  position: absolute;
  right: -48rpx;
  top: -58rpx;
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: rgba(255, 191, 63, 0.24);
  content: "";
}

.login-card::after {
  position: absolute;
  right: 42rpx;
  top: 42rpx;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: #ff6f61;
  box-shadow: 18rpx -12rpx 0 #d9f5e6;
  content: "";
}

.brand-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.brand-logo {
  width: 66rpx;
  height: 66rpx;
  margin-right: 16rpx;
  border-radius: 14rpx;
  background: #16945f;
}

.brand-name {
  color: #17362f;
  font-size: 38rpx;
  font-weight: 900;
}

.field-row {
  display: grid;
  grid-template-columns: 76rpx minmax(0, 1fr);
  gap: 14rpx;
  align-items: center;
  margin-bottom: 18rpx;
}

.field-label {
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
  text-align: right;
}

.soft-button {
  width: 100%;
  margin-top: 6rpx;
}

.login-error {
  min-height: 36rpx;
  margin: -4rpx 0 14rpx 90rpx;
  color: #d64b3f;
  font-size: 24rpx;
  font-weight: 800;
}
</style>
