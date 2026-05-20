import App from './App'

import Vue from 'vue'
// #ifdef MP-WEIXIN
import shareMixin from './mixins/share'
// #endif

Vue.config.productionTip = false
// #ifdef MP-WEIXIN
Vue.mixin(shareMixin)
// #endif
App.mpType = 'app'

const app = new Vue({
  ...App
})

app.$mount()
