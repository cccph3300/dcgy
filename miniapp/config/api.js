// 本地和服务器地址都固定写在这里，切换环境时不要手动改代码。
export const LOCAL_API_BASE = 'http://localhost:3000'
export const SERVER_API_BASE = 'http://43.136.124.239'

// 微信正式版不能直接请求未备案 IP，正式版默认走腾讯云 AnyService。
export const MINIAPP_RELEASE_USE_ANYSERVICE = true

function resolveApiBase() {
  // #ifdef H5
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin
    }
  }
  // #endif

  // #ifdef MP-WEIXIN
  const envVersion = getMiniProgramEnvVersion()
  if (envVersion === 'release' || envVersion === 'trial') {
    return SERVER_API_BASE
  }
  // #endif

  return LOCAL_API_BASE
}

export const API_BASE = resolveApiBase()

// 临时内网穿透示例
// export const API_BASE = 'https://422pz6op0686.vicp.fun'
// 腾讯云 AnyService 配置：服务标识对应控制台中创建的 dcapi。
export const ANYSERVICE_NAME = 'dcapi'
export const ANYSERVICE_WX_SERVICE = 'tcbanyservice'

export const TCB_ENV_ID = 'dongchenggy-d5gq5xkv09bd2537e'

export function getMiniProgramEnvVersion() {
  // #ifdef MP-WEIXIN
  try {
    return wx.getAccountInfoSync?.().miniProgram?.envVersion || 'develop'
  } catch (err) {
    return 'develop'
  }
  // #endif

  return ''
}

export function shouldUseAnyService() {
  // #ifdef MP-WEIXIN
  const envVersion = getMiniProgramEnvVersion()
  return MINIAPP_RELEASE_USE_ANYSERVICE && (envVersion === 'release' || envVersion === 'trial')
  // #endif

  return false
}

// 文本识别服务配置。小程序正式版同样需要 HTTPS 域名，并加入微信后台合法域名。
export const OCR_URL = `${API_BASE.replace(/\/$/, '')}/api/ocr`
export const OCR_KEY = 'local-test-key-please-change'
// 当前小程序端 OCR 通过主后端 /api/ocr 代理转发，这里保留 dcocr 备用。
export const OCR_ANYSERVICE_NAME = 'dcocr'

// 本地草稿缓存 Key 统一放这里，避免页面里散落硬编码字符串。
export const DELIVERY_OCR_DRAFT_KEY = 'delivery_ocr_draft'
export const DELIVERY_CREATE_DRAFT_KEY = 'delivery_create_draft'
