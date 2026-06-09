<template>
  <view class="page delivery-recycle">
    <view class="recycle-head">
      <view>
        <view class="head-label">超市配送</view>
        <view class="head-title">订单回收站</view>
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

    <view class="soft-card tip-card">
      <view class="tip-title">这里只放已作废的超市配送单</view>
      <view class="tip-text">可以查看送货单，也可以还原回正常订单状态。</view>
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
            <view class="market-block">
              <text class="market-name">{{ order.supermarketName }}</text>
              <text class="order-time">{{ timeText(order.createdAt) }}</text>
            </view>
            <view class="amount">¥{{ money(order.totalAmount) }}</view>
          </view>

          <view class="order-no">单号 {{ order.orderNo || order.id }}</view>
          <view class="item-preview">利润 ¥{{ money(order.totalProfit) }} · {{ order.itemCount || 0 }} 项商品</view>

          <view class="action-row">
            <button class="action-button view-button" @click.stop="openDetail(order.id)">查看送货单</button>
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
        <view class="empty-text">作废后的超市配送单会出现在这里。</view>
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
import { request, requireLogin } from '../../utils/request'
import { money, timeText } from '../../utils/format'

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
    async loadOrders() {
      this.loading = true
      this.error = ''
      try {
        const result = await request({
          url: `/api/supermarket-orders?date=all&status=cancelled&page=${this.pagination.page}&pageSize=${this.pagination.pageSize}`
        })
        this.orders = Array.isArray(result) ? result : (result.items || [])
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
        this.error = err.message || '超市订单回收站读取失败'
      } finally {
        this.loading = false
      }
    },
    openDetail(id) {
      uni.navigateTo({ url: `/subpackages/delivery/detail?id=${id}` })
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
        content: `将彻底删除回收站内 ${this.pagination.total} 单作废超市订单，操作不可逆。`,
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
        const result = await request({ url: '/api/supermarket-orders/recycle', method: 'DELETE' })
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
        title: '彻底删除超市订单？',
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
        await request({ url: `/api/supermarket-orders/${order.id}/destroy`, method: 'DELETE' })
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
        title: '还原超市订单？',
        content: '还原后会重新扣减自家商品库存，库存不足则无法还原。',
        confirmText: '还原',
        success: async (res) => {
          if (!res.confirm) return
          this.restoringId = id
          try {
            await request({ url: `/api/supermarket-orders/${id}/restore`, method: 'PATCH' })
            uni.showToast({ title: '已还原', icon: 'success' })
            await this.reloadAfterChange()
          } catch (err) {
            uni.showToast({ title: err.message || '还原失败', icon: 'none' })
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
  color: #4d6ed8;
  font-size: 24rpx;
  font-weight: 900;
}

.head-title {
  margin-top: 8rpx;
  color: #1f2f63;
  font-size: 42rpx;
  font-weight: 900;
}

.head-count {
  min-width: 96rpx;
  height: 52rpx;
  border-radius: 18rpx;
  background: #e9eefb;
  color: #4d6ed8;
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
  background: #dce1ef;
  color: #7d879d;
}

.clear-recycle-button::after,
.trash-delete-button::after {
  display: none;
}

.tip-card {
  border-color: #cdd8fb;
  background: linear-gradient(135deg, #ffffff 0%, #f4f7ff 100%);
}

.tip-title {
  color: #1f2f63;
  font-size: 28rpx;
  font-weight: 900;
}

.tip-text {
  margin-top: 6rpx;
  color: #697597;
  font-size: 24rpx;
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
  border: 2rpx solid #d9e1fb;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(52, 73, 140, 0.08);
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

.market-block {
  display: grid;
  gap: 8rpx;
  min-width: 0;
}

.market-name {
  overflow: hidden;
  color: #1f2f63;
  font-size: 30rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-time,
.order-no,
.item-preview {
  color: #697597;
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
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-preview {
  color: #4b5b82;
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
  background: #e9eefb;
  color: #4d6ed8;
}

.restore-button {
  background: #4d6ed8;
  color: #ffffff;
}

.restore-button[disabled] {
  opacity: 0.68;
}

.empty,
.empty-state {
  color: #697597;
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
  background: #e9eefb;
  color: #4d6ed8;
  font-size: 38rpx;
  font-weight: 900;
}

.empty-title {
  color: #1f2f63;
  font-size: 30rpx;
  font-weight: 900;
}

.empty-text {
  margin-top: 8rpx;
  color: #697597;
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
  background: #e9eefb;
  color: #4d6ed8;
  line-height: 58rpx;
}

.pager-button[disabled] {
  color: #9ca7c0;
  opacity: 0.7;
}

.pager-current {
  background: #ffffff;
  color: #1f2f63;
  line-height: 58rpx;
  text-align: center;
}
</style>
