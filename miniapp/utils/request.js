import { ANYSERVICE_ENABLED, ANYSERVICE_NAME, ANYSERVICE_WX_SERVICE, API_BASE, TCB_ENV_ID } from '../config/api'

const TOKEN_KEY = 'dcgy_token'
const STAFF_KEY = 'dcgy_staff'

export function getToken() {
  return uni.getStorageSync(TOKEN_KEY)
}

export function setSession(token, staff) {
  uni.setStorageSync(TOKEN_KEY, token)
  uni.setStorageSync(STAFF_KEY, staff)
}

export function clearSession() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(STAFF_KEY)
}

export function getStaff() {
  return uni.getStorageSync(STAFF_KEY)
}

export function requireLogin() {
  if (!getToken()) {
    const pages = getCurrentPages()
    const currentRoute = pages[pages.length - 1]?.route
    if (currentRoute !== 'pages/login/index') {
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/login/index' })
      }, 0)
    }
    return false
  }
  return true
}

export function request(options) {
  const token = getToken()
  const needAuth = options.auth !== false
  const header = {
    'content-type': 'application/json',
    ...(options.header || {}),
    ...(needAuth && token ? { Authorization: `Bearer ${token}` } : {})
  }
  const baseUrl = API_BASE.replace(/\/$/, '')

  // #ifdef MP-WEIXIN
  if (ANYSERVICE_ENABLED) {
    return requestByAnyService(options, header, needAuth)
  }
  // #endif

  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      url: `${baseUrl}${options.url}`,
      header,
      timeout: options.timeout || 15000,
      success(res) {
        if (needAuth && res.statusCode === 401) {
          clearSession()
          uni.reLaunch({ url: '/pages/login/index' })
          reject(new Error('请先登录'))
          return
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = res.data?.statusMessage || res.data?.message || '请求失败'
          uni.showToast({ title: message, icon: 'none' })
          reject(new Error(message))
          return
        }

        resolve(res.data)
      },
      fail(err) {
        const message = err?.errMsg?.includes('timeout') ? '请求超时，请检查接口地址' : '网络连接失败'
        uni.showToast({ title: message, icon: 'none' })
        reject(new Error(message))
      }
    })
  })
}

// 微信正式版不能直接请求未备案 IP，AnyService 会在云侧转发到 dcapi 对应的公网服务。
function requestByAnyService(options, header, needAuth) {
  return new Promise((resolve, reject) => {
    if (!TCB_ENV_ID) {
      const err = new Error('请先配置腾讯云开发环境 ID')
      uni.showToast({ title: err.message, icon: 'none' })
      reject(err)
      return
    }

    if (!wx?.cloud?.callContainer) {
      const err = new Error('云开发 AnyService 未初始化')
      uni.showToast({ title: err.message, icon: 'none' })
      reject(err)
      return
    }

    wx.cloud.callContainer({
      path: options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        ...header,
        'X-WX-SERVICE': ANYSERVICE_WX_SERVICE,
        'X-AnyService-Name': ANYSERVICE_NAME,
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 15000,
      success(res) {
        const statusCode = res.statusCode || 200
        if (needAuth && statusCode === 401) {
          clearSession()
          uni.reLaunch({ url: '/pages/login/index' })
          reject(new Error('请先登录'))
          return
        }

        if (statusCode < 200 || statusCode >= 300) {
          const message = res.data?.statusMessage || res.data?.message || '请求失败'
          uni.showToast({ title: message, icon: 'none' })
          reject(new Error(message))
          return
        }

        resolve(res.data)
      },
      fail(err) {
        const message = err?.errMsg?.includes('timeout') ? '请求超时，请检查 AnyService 配置' : '网络连接失败'
        uni.showToast({ title: message, icon: 'none' })
        reject(new Error(message))
      }
    })
  })
}
