<template>
  <view class="page recycle-page">
    <view class="recycle-head">
      <view>
        <view class="head-label">订单回收站</view>
        <view class="head-title">已毁单记录</view>
      </view>
      <view class="head-actions">
        <view class="head-count">{{ pagination.total }}单</view>
        <button
          class="clear-recycle-button"
          :disabled="!pagination.total || clearing"
          @click="confirmClearRecycle"
        >
          {{ clearing ? '清空中' : '清空回收站' }}
        </button>
      </view>
    </view>


    <view v-if="loading" class="soft-card empty">正在读取回收站...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <view v-else class="recycle-list">
      <view
        v-for="order in orders"
        :key="order.id"
        class="trash-swipe"
        @touchstart="touchOrderStart"
        @touchend="touchOrderEnd($event, order)"
      >
        <button
          class="trash-delete-button"
          :disabled="deletingId === order.id"
          @click.stop="confirmDeleteOrder(order)"
        >
          {{ deletingId === order.id ? '删除中' : '删除' }}
        </button>
        <view
          class="trash-card"
          :class="{ swiped: swipedOrderId === order.id }"
          @click="closeSwipedOrder"
        >
          <view class="trash-top">
            <view class="customer-block">
              <text class="customer-name" :class="order.customerClassName">{{ order.customerName }}</text>
              <text class="order-time">{{ timeText(order.createdAt) }}</text>
            </view>
            <view class="amount">¥{{ money(order.totalAmount) }}</view>
          </view>

          <view class="order-no">单号 {{ order.orderNo || order.id }}</view>
          <view class="item-preview">{{ itemPreview(order) }}</view>

          <view class="action-row">
            <button class="action-button view-button" @click.stop="openDetail(order.id)">查看订单</button>
            <button
              class="action-button restore-button"
              :disabled="restoringId === order.id"
              @click.stop="restoreOrder(order.id)"
            >
              {{ restoringId === order.id ? '还原中' : '还原订单' }}
            </button>
          </view>
        </view>
      </view>

      <view v-if="!orders.length" class="soft-card empty-state">
        <view class="empty-icon">收</view>
        <view class="empty-title">回收站是空的</view>
        <view class="empty-text">毁单后的订单会出现在这里。</view>
      </view>

      <view v-if="pagination.totalPages > 1" class="pager">
        <button class="pager-button" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">上一页</button>
        <picker :value="pageIndex" :range="pageOptions" range-key="label" @change="selectPage">
          <view class="pager-current">第 {{ pagination.page }} / {{ pagination.totalPages }} 页</view>
        </picker>
        <button class="pager-button" :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">下一页</button>
      </view>
    </view>
  </view>
</template>

<script>
import { request, requireLogin } from '../../../utils/request'
import { money, numberText, timeText } from '../../../utils/format'

export default {
  data() {
    return {
      orders: [],
      pagination: {
        page: 1,
        pageSize: 4,
        total: 0,
        totalPages: 1
      },
      loading: false,
      error: '',
      restoringId: '',
      deletingId: '',
      clearing: false,
      swipedOrderId: '',
      touchStartX: 0
    }
  },
  computed: {
    pageOptions() {
      return Array.from({ length: this.pagination.totalPages }, (_, index) => ({
        label: `第 ${index + 1} 页`,
        value: index + 1
      }))
    },
    pageIndex() {
      return Math.max(this.pagination.page - 1, 0)
    }
  },
  onShow() {
    if (requireLogin()) this.loadOrders()
  },
  methods: {
    money,
    timeText,
    getCustomerClass(name) {
      if ((name || '').trim() === '客户') return 'customer-default'
      const colors = ['customer-a', 'customer-b', 'customer-c', 'customer-d', 'customer-e']
      const code = String(name || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
      return colors[code % colors.length]
    },
    async loadOrders() {
      this.loading = true
      this.error = ''
      try {
        const result = await request({
          url: `/api/orders?date=all&status=cancelled&page=${this.pagination.page}&pageSize=${this.pagination.pageSize}`
        })
        const list = Array.isArray(result) ? result : (result.items || [])
        this.orders = list
          .filter(order => order.status === 'cancelled')
          .map(order => ({
            ...order,
            customerClassName: this.getCustomerClass(order.customerName)
          }))
        if (result && result.pagination) {
          this.pagination = {
            ...result.pagination,
            pageSize: result.pagination.pageSize || this.pagination.pageSize
          }
        } else {
          this.pagination = {
            page: 1,
            pageSize: this.pagination.pageSize,
            total: this.orders.length,
            totalPages: 1
          }
        }
      } catch (err) {
        this.orders = []
        this.pagination = {
          page: 1,
          pageSize: this.pagination.pageSize,
          total: 0,
          totalPages: 1
        }
        this.error = err.message || '回收站读取失败'
      } finally {
        this.loading = false
      }
    },
    itemPreview(order) {
      const items = Array.isArray(order.items) ? order.items : []
      if (!items.length) return '暂无商品明细'
      return items.slice(0, 2).map(item => {
        const count = numberText(item.quantity || 0)
        return `${item.goodsName} ${count}件`
      }).join('、')
    },
    openDetail(id) {
      uni.navigateTo({ url: `/pages/orders/detail?id=${id}` })
    },
    touchOrderStart(event) {
      this.touchStartX = event.changedTouches?.[0]?.clientX || 0
    },
    touchOrderEnd(event, order) {
      const endX = event.changedTouches?.[0]?.clientX || 0
      const diff = endX - this.touchStartX
      if (diff < -36) {
        this.swipedOrderId = order.id
      } else if (diff > 28) {
        this.swipedOrderId = ''
      }
    },
    closeSwipedOrder() {
      if (this.swipedOrderId) this.swipedOrderId = ''
    },
    changePage(page) {
      const nextPage = Math.min(Math.max(Number(page), 1), this.pagination.totalPages)
      if (nextPage === this.pagination.page) return
      this.pagination.page = nextPage
      this.swipedOrderId = ''
      this.loadOrders()
    },
    selectPage(event) {
      const option = this.pageOptions[Number(event.detail.value)]
      if (!option) return
      this.changePage(option.value)
    },
    async reloadAfterChange() {
      await this.loadOrders()
      if (!this.orders.length && this.pagination.page > 1) {
        this.pagination.page -= 1
        await this.loadOrders()
      }
    },
    confirmClearRecycle() {
      if (!this.pagination.total || this.clearing) return
      uni.showModal({
        title: '清空回收站？',
        content: `将彻底删除回收站内 ${this.pagination.total} 单毁单订单，操作不可逆。`,
        confirmText: '清空',
        confirmColor: '#d64b3f',
        success: async (res) => {
          if (!res.confirm) return
          await this.clearRecycle()
        }
      })
    },
    async clearRecycle() {
      this.clearing = true
      try {
        const result = await request({ url: '/api/orders/recycle', method: 'DELETE' })
        uni.showToast({ title: `已清空${result?.count || 0}单`, icon: 'success' })
        this.pagination.page = 1
        this.swipedOrderId = ''
        await this.loadOrders()
      } catch (err) {
        uni.showToast({ title: err.message || '清空失败', icon: 'none' })
      } finally {
        this.clearing = false
      }
    },
    confirmDeleteOrder(order) {
      if (!order || this.deletingId) return
      uni.showModal({
        title: '彻底删除订单？',
        content: `操作不可逆。\n单号：${order.orderNo || order.id}`,
        confirmText: '删除',
        confirmColor: '#d64b3f',
        success: async (res) => {
          if (!res.confirm) return
          await this.deleteOrder(order)
        }
      })
    },
    async deleteOrder(order) {
      this.deletingId = order.id
      try {
        await request({ url: `/api/orders/${order.id}/destroy`, method: 'DELETE' })
        uni.showToast({ title: '已彻底删除', icon: 'success' })
        this.swipedOrderId = ''
        await this.reloadAfterChange()
      } catch (err) {
        uni.showToast({ title: err.message || '删除失败', icon: 'none' })
      } finally {
        this.deletingId = ''
      }
    },
    restoreOrder(id) {
      uni.showModal({
        title: '还原订单？',
        content: '还原后订单会回到未付状态，请确认库存是否需要同步处理。',
        confirmText: '还原',
        success: async (res) => {
          if (!res.confirm) return
          this.restoringId = id
          try {
            await request({ url: `/api/orders/${id}/restore`, method: 'PATCH' })
            uni.showToast({ title: '已还原到未付订单', icon: 'success' })
            await this.reloadAfterChange()
          } catch (err) {
            const message = err.message || '还原失败，请确认后端已支持订单还原接口'
            uni.showToast({ title: message, icon: 'none' })
          } finally {
            this.restoringId = ''
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.recycle-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 18rpx 8rpx 14rpx;
}

.head-label {
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
}

.head-title {
  margin-top: 8rpx;
  color: #17362f;
  font-size: 42rpx;
  font-weight: 900;
}

.head-count {
  min-width: 96rpx;
  height: 52rpx;
  border-radius: 18rpx;
  background: #fff6cf;
  color: #17362f;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 52rpx;
  text-align: center;
}

.head-actions {
  display: grid;
  justify-items: end;
  gap: 10rpx;
}

.clear-recycle-button {
  width: 168rpx;
  height: 54rpx;
  min-height: 54rpx;
  border-radius: 14rpx;
  background: #d64b3f;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 54rpx;
}

.clear-recycle-button[disabled] {
  background: #dce6ed;
  color: #7b8a94;
}

.clear-recycle-button::after,
.trash-delete-button::after {
  display: none;
}

.tip-card {
  border-color: #c9dcc9;
  background: linear-gradient(135deg, #ffffff 0%, #f2fbf4 100%);
}

.tip-title {
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
}

.tip-text {
  margin-top: 6rpx;
  color: #718078;
  font-size: 24rpx;
}

.recycle-list {
  padding-bottom: 20rpx;
}

.trash-swipe {
  position: relative;
  margin-bottom: 16rpx;
  overflow: hidden;
  border-radius: 18rpx;
}

.trash-delete-button {
  position: absolute;
  top: 6rpx;
  right: 0;
  bottom: 6rpx;
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 124rpx;
  min-height: auto;
  margin: 0;
  border-radius: 0 18rpx 18rpx 0;
  background: #d64b3f;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 900;
}

.trash-delete-button[disabled] {
  opacity: 0.72;
}

.trash-card {
  position: relative;
  z-index: 1;
  padding: 18rpx;
  border: 2rpx solid #e4d7d4;
  border-radius: 18rpx;
  background: #fffef9;
  box-shadow: 0 10rpx 22rpx rgba(60, 45, 36, 0.07);
  transition: transform 0.18s ease;
  will-change: transform;
}

.trash-card.swiped {
  transform: translateX(-132rpx);
}

.trash-top {
  display: flex;
  gap: 12rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.customer-block {
  display: grid;
  gap: 8rpx;
  min-width: 0;
}

.customer-name {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 260rpx;
  min-height: 42rpx;
  padding: 0 14rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 26rpx;
  font-weight: 900;
}

.customer-default {
  background: #edf2eb;
  color: #748078;
}

.customer-a {
  background: #fff0c8;
  color: #9b6b00;
}

.customer-b {
  background: #ffe2dc;
  color: #c4493e;
}

.customer-c {
  background: #ebe6ff;
  color: #6b50c8;
}

.customer-d {
  background: #e0f0ff;
  color: #315f8f;
}

.customer-e {
  background: #e8f6ed;
  color: #166b4e;
}

.order-time {
  color: #718078;
  font-size: 24rpx;
}

.amount {
  color: #d64b3f;
  font-size: 34rpx;
  font-weight: 900;
}

.order-no,
.item-preview {
  overflow: hidden;
  margin-top: 12rpx;
  color: #718078;
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-preview {
  color: #415149;
  font-weight: 800;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 16rpx;
}

.action-button {
  height: 62rpx;
  min-height: 62rpx;
  border-radius: 14rpx;
  font-size: 26rpx;
  font-weight: 900;
}

.view-button {
  background: #e8f6ed;
  color: #166b4e;
}

.restore-button {
  background: #16945f;
  color: #ffffff;
}

.restore-button[disabled] {
  opacity: 0.68;
}

.empty,
.empty-state {
  color: #718078;
  text-align: center;
}

.empty-state {
  padding: 48rpx 20rpx;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 90rpx;
  height: 90rpx;
  margin: 0 auto 16rpx;
  border-radius: 28rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 38rpx;
  font-weight: 900;
}

.empty-title {
  color: #17362f;
  font-size: 30rpx;
  font-weight: 900;
}

.empty-text {
  margin-top: 8rpx;
  color: #718078;
  font-size: 24rpx;
}

.error {
  color: #d64b3f;
}

.pager {
  display: grid;
  grid-template-columns: 124rpx minmax(0, 1fr) 124rpx;
  gap: 10rpx;
  align-items: center;
  margin-top: 18rpx;
}

.pager-button,
.pager-current {
  height: 58rpx;
  min-height: 58rpx;
  border-radius: 14rpx;
  font-size: 24rpx;
  font-weight: 900;
}

.pager-button {
  background: #e4f0fa;
  color: #245277;
  line-height: 58rpx;
}

.pager-button[disabled] {
  color: #9aaab5;
  opacity: 0.7;
}

.pager-current {
  background: #ffffff;
  color: #17364e;
  line-height: 58rpx;
  text-align: center;
}

.recycle-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 4%, rgba(36, 82, 119, 0.14), transparent 190rpx),
    linear-gradient(180deg, #f6fbff 0%, #eef7ff 100%);
}

.head-label,
.empty-icon {
  color: #245277;
}

.head-title,
.empty-title,
.item-title {
  color: #17364e;
}

.soft-card,
.tip-card,
.trash-card,
.empty-state {
  border-color: #c9dcea;
  background: linear-gradient(145deg, #ffffff 0%, #f2f8ff 100%);
}

.empty-icon,
.view-button,
.restore-button[disabled] {
  background: #e4f0fa;
}

.restore-button {
  background: #245277;
  color: #ffffff;
}
</style>
