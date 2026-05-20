const SHARE_TITLE = '东成果业'
const SHARE_HOME_PATH = '/pages/order/index'

function encodeQuery(options = {}) {
  return Object.keys(options)
    .filter(key => options[key] !== undefined && options[key] !== null && options[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`)
    .join('&')
}

function getCurrentSharePath() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (!currentPage || !currentPage.route) return SHARE_HOME_PATH

  const query = encodeQuery(currentPage.options || currentPage.$page?.options || {})
  return `/${currentPage.route}${query ? `?${query}` : ''}`
}

function getCurrentShareQuery() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (!currentPage) return ''

  return encodeQuery(currentPage.options || currentPage.$page?.options || {})
}

export default {
  onShow() {
    // 统一打开右上角转发入口，特殊页面仍可用自己的 onShareAppMessage 覆盖分享内容。
    // #ifdef MP-WEIXIN
    if (wx?.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      })
    }
    // #endif
  },
  onShareAppMessage() {
    return {
      title: SHARE_TITLE,
      path: getCurrentSharePath()
    }
  },
  onShareTimeline() {
    return {
      title: SHARE_TITLE,
      query: getCurrentShareQuery()
    }
  }
}
