<template>
  <view class="redirect-page">正在打开送货详情...</view>
</template>

<script>
export default {
  onLoad(query) {
    const queryText = this.buildQuery(query)
    uni.redirectTo({ url: `/subpackages/delivery/detail${queryText}` })
  },
  methods: {
    buildQuery(query = {}) {
      const entries = Object.keys(query)
        .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== '')
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
      return entries.length ? `?${entries.join('&')}` : ''
    }
  }
}
</script>

<style scoped>
.redirect-page {
  padding: 48rpx 28rpx;
  color: #718078;
  font-size: 28rpx;
  text-align: center;
}
</style>
