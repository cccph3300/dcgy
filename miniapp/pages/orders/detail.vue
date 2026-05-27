<template>
  <view class="page">
    <view class="soft-card head-row">
      <button class="soft-button" @click="goBack">{{ text.back }}</button>
      <view v-if="order" class="head-actions">
        <text class="status-text" :class="order.status">{{ detailStatusText }}</text>
        <button class="soft-button print" :disabled="printing" @click="printOrder">{{ printing ? text.printing : text.printBill }}</button>
        <button v-if="order.status === 'unpaid'" class="soft-button success" @click="markPaid">{{ text.checkout }}</button>
        <button v-if="order.status === 'unpaid'" class="soft-button danger" @click="cancelOrder">{{ text.cancel }}</button>
        <button v-if="order.status === 'paid'" class="soft-button danger" @click="deleteOrder">{{ text.delete }}</button>
      </view>
    </view>

    <view v-if="loading" class="soft-card empty">{{ text.loading }}</view>
    <view v-else-if="error" class="soft-card error">{{ error }}</view>

    <template v-else-if="order">
      <view v-if="!editing" class="soft-card summary">
        <view>
          <text class="muted">{{ text.customer }}</text>
          <text class="strong customer-badge" :class="order.customerClassName">{{ order.customerName }}</text>
        </view>
        <view>
          <text class="muted">{{ text.time }}</text>
          <text class="strong">{{ timeText(order.createdAt) }}</text>
        </view>
        <view>
          <text class="muted">{{ text.total }}</text>
          <text class="strong">{{ text.currency }}{{ money(order.totalAmount) }}</text>
        </view>
      </view>

      <view v-if="!editing" class="soft-card">
        <view class="section-title title-row">
          <text>{{ text.orderContent }}</text>
          <button v-if="canEditOrder" class="content-edit-button" @click="startEdit">{{ text.edit }}</button>
        </view>
        <view v-for="item in order.items" :key="item.id" class="detail-row">
          <text class="detail-text">{{ itemText(item) }}</text>
          <view class="detail-side">
            <text class="detail-price">{{ text.currency }}{{ money(item.subtotal) }}</text>
            <text v-if="profitMode" class="detail-profit" :class="{ loss: itemProfit(item) < 0 }">利{{ text.currency }}{{ money(itemProfit(item)) }}</text>
          </view>
        </view>
        <view class="total">{{ text.totalAmount }}{{ text.currency }}{{ money(order.totalAmount) }}</view>
        <view v-if="profitMode" class="total profit-total">总利润：{{ text.currency }}{{ money(orderProfit) }}</view>
      </view>

      <view v-else class="soft-card edit-panel">
        <view class="section-title">{{ text.editOrder }}</view>
        <view class="edit-field customer-edit-field">
          <text>{{ text.customer }}</text>
          <input
            v-model="editForm.customerName"
            class="input edit-input"
            @input="onEditCustomerInput"
            @focus="searchEditCustomers"
          />
          <scroll-view v-if="editCustomerSuggestions.length" class="edit-suggest-float" scroll-y enhanced>
            <view
              v-for="customer in editCustomerSuggestions"
              :key="customer.id"
              class="edit-suggest-item"
              @click="selectEditCustomer(customer)"
            >
              {{ customer.name }}
            </view>
          </scroll-view>
        </view>
        <view v-if="missedMode" class="edit-date-grid">
          <view class="edit-field">
            <text>{{ text.orderDate }}</text>
            <picker mode="date" :value="editForm.createdDate" @change="changeEditDate">
              <view class="input edit-input picker-value">{{ editForm.createdDate }}</view>
            </picker>
          </view>
          <view class="edit-field">
            <text>{{ text.orderTime }}</text>
            <picker mode="time" :value="editForm.createdTime" @change="changeEditTime">
              <view class="input edit-input picker-value">{{ editForm.createdTime }}</view>
            </picker>
          </view>
        </view>

        <view class="add-section" :class="{ open: addingGoods }">
          <button class="add-toggle-button" @click="toggleAddGoods">
            {{ addingGoods ? '收起新增商品' : '添加商品' }}
          </button>
          <view v-if="addingGoods" class="add-content">
            <input v-model="goodsKeyword" class="input goods-search" placeholder="搜索库存商品" @input="activeGoods = null" />
            <scroll-view v-if="filteredGoods.length" class="goods-scroll" scroll-y :show-scrollbar="true" enhanced>
              <view class="goods-grid">
                <view
                  v-for="goods in filteredGoods"
                  :key="goods.id"
                  class="goods-cell"
                  :class="{ active: activeGoods && activeGoods.id === goods.id }"
                  @click="selectGoods(goods)"
                >
                  <text class="goods-name">{{ goods.name }}</text>
                  <text class="muted">{{ numberText(goods.stock) }}件</text>
                </view>
              </view>
            </scroll-view>
            <view v-else class="empty add-empty">没有找到库存商品</view>

            <view v-if="activeGoods" class="new-item-panel">
              <view class="panel-title">{{ activeGoods.name }}</view>
              <view class="edit-grid">
                <view class="edit-field">
                  <text>件数</text>
                  <input v-model="newItem.quantity" class="input edit-input" type="digit" />
                </view>
                <view v-if="activeGoods.unitType === 'weight'" class="edit-field">
                  <text>重量</text>
                  <input v-model="newItem.weight" class="input edit-input" type="digit" />
                </view>
                <view class="edit-field">
                  <text>价格</text>
                  <input v-model="newItem.price" class="input edit-input" type="digit" />
                </view>
                <view class="edit-field">
                  <text>售佣</text>
                  <input v-model="newItem.commission" class="input edit-input" type="digit" />
                </view>
              </view>
              <button class="soft-button primary add-button" @click="addEditItem">加入订单 ¥{{ money(newItemTotal) }}</button>
            </view>
          </view>
        </view>

        <view v-for="(item, index) in editForm.items" :key="item.id || index" class="edit-item">
          <view class="edit-item-head">
            <text class="edit-goods">{{ item.goodsName }}</text>
            <button class="mini-delete" @click="removeEditItem(index)">删</button>
          </view>
          <view class="edit-grid">
            <view class="edit-field">
              <text>件数</text>
              <input v-model="item.quantity" class="input edit-input" type="digit" @input="updateEditItem(item)" />
            </view>
            <view v-if="item.unitType === 'weight'" class="edit-field">
              <text>重量</text>
              <input v-model="item.weight" class="input edit-input" type="digit" @input="updateEditItem(item)" />
            </view>
            <view class="edit-field">
              <text>价格</text>
              <input v-model="item.price" class="input edit-input" type="digit" @input="updateEditItem(item)" />
            </view>
            <view class="edit-field">
              <text>售佣</text>
              <input v-model="item.commission" class="input edit-input" type="digit" @input="updateEditItem(item)" />
            </view>
          </view>
          <view class="edit-subtotal">小计 {{ text.currency }}{{ money(item.subtotal) }}</view>
        </view>

        <view v-if="!editForm.items.length" class="empty">{{ text.noItems }}</view>
        <view class="total">{{ text.totalAmount }}{{ text.currency }}{{ money(editTotal) }}</view>
        <view class="edit-actions">
          <button class="soft-button" @click="cancelEdit">{{ text.cancelEdit }}</button>
          <button class="soft-button primary" :disabled="saving" @click="saveEdit">{{ saving ? text.saving : text.saveEdit }}</button>
        </view>
      </view>

      <button v-if="order.customerId && !editing" class="share-button" @click="openCustomerBill">{{ text.viewTotalBill }}</button>
    </template>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money, numberText, timeText } from '../../utils/format'

const zh = {
  back: '\u8fd4\u56de',
  customer: '\u5ba2\u6237',
  time: '\u65f6\u95f4',
  total: '\u603b\u989d',
  currency: '\uffe5',
  orderContent: '\u4e0b\u5355\u5185\u5bb9',
  totalAmount: '\u603b\u91d1\u989d\uff1a',
  loading: '\u6b63\u5728\u8bfb\u53d6\u8ba2\u5355...',
  checkout: '\u7ed3\u8d26',
  cancel: '\u6bc1\u5355',
  delete: '\u5220\u9664',
  edit: '\u7f16\u8f91',
  editOrder: '\u7f16\u8f91\u8ba2\u5355',
  orderDate: '日期',
  orderTime: '时间',
  cancelEdit: '\u53d6\u6d88',
  saveEdit: '\u4fdd\u5b58\u4fee\u6539',
  saving: '\u4fdd\u5b58\u4e2d',
  noItems: '\u8ba2\u5355\u660e\u7ec6\u4e0d\u80fd\u4e3a\u7a7a',
  printBill: '\u6253\u5370\u8d26\u5355',
  printing: '\u6253\u5370\u4e2d',
  printSuccess: '\u5df2\u53d1\u9001\u6253\u5370',
  unpaid: '\u672a\u4ed8',
  customerPaid: '\u5ba2\u6237\u5df2\u4ed8\u6e05',
  cancelled: '\u5df2\u6bc1\u5355',
  confirmCheckout: '\u786e\u8ba4\u7ed3\u8d26\uff1f',
  confirmCancel: '\u786e\u8ba4\u6bc1\u5355\uff1f',
  cancelTip: '\u6bc1\u5355\u540e\u4f1a\u6062\u590d\u5e93\u5b58',
  confirmDelete: '\u786e\u8ba4\u5220\u9664\uff1f',
  deleteTip: '\u5220\u9664\u540e\u4e0d\u4f1a\u6062\u590d\u5e93\u5b58',
  viewTotalBill: '\u67e5\u770b\u603b\u8d26\u5355',
  shareTitle: '\u7684\u6b20\u8d26\u5355',
  loadFailed: '\u8ba2\u5355\u8bfb\u53d6\u5931\u8d25'
}

export default {
  data() {
    return {
      text: zh,
      id: '',
      profitMode: false,
      missedMode: false,
      autoEdit: false,
      order: null,
      shareToken: '',
      editing: false,
      saving: false,
      editForm: {
        customerName: '',
        createdDate: '',
        createdTime: '',
        items: []
      },
      editCustomerSuggestions: [],
      editCustomerTimer: null,
      goodsList: [],
      goodsKeyword: '',
      addingGoods: false,
      activeGoods: null,
      newItem: {
        quantity: '1',
        weight: '',
        price: '',
        commission: ''
      },
      printing: false,
      loading: true,
      error: ''
    }
  },
  computed: {
    detailStatusText() {
      if (!this.order) return ''
      if (this.order.status === 'paid') return this.text.customerPaid
      if (this.order.status === 'cancelled') return this.text.cancelled
      return this.text.unpaid
    },
    editTotal() {
      return this.editForm.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
    },
    filteredGoods() {
      const keyword = this.goodsKeyword.trim()
      if (!keyword) return this.goodsList
      return this.goodsList.filter(goods => goods.name.includes(keyword))
    },
    newItemTotal() {
      const goods = this.activeGoods
      if (!goods) return 0
      const quantity = Number(this.newItem.quantity || 0)
      const weight = Number(this.newItem.weight || 0)
      const price = Number(this.newItem.price || 0)
      const commission = Number(this.newItem.commission || 0)
      return goods.unitType === 'weight' && weight > 0
        ? Number((weight * price + quantity * commission).toFixed(2))
        : Number((quantity * price + quantity * commission).toFixed(2))
    },
    canEditOrder() {
      return this.order && (this.missedMode || this.order.status === 'unpaid' || this.order.status === 'cancelled')
    },
    orderProfit() {
      if (!this.order) return 0
      if (this.order.profitAmount !== undefined && this.order.profitAmount !== null) return Number(this.order.profitAmount || 0)
      return (this.order.items || []).reduce((sum, item) => sum + this.itemProfit(item), 0)
    }
  },
  onLoad(query) {
    this.id = query.id
    this.profitMode = query.profit === '1'
    this.missedMode = query.missed === '1'
    this.autoEdit = query.edit === '1'
  },
  onShow() {
    if (requireLogin() && !this.editing) this.loadOrder()
  },
  onUnload() {
    if (this.editCustomerTimer) clearTimeout(this.editCustomerTimer)
  },
  async onShareAppMessage() {
    const token = await this.ensureShareToken()
    const customerName = this.order?.customerName || ''
    return {
      title: `${customerName}${this.text.shareTitle}`,
      path: `/pages/orders/debt?customerId=${this.order.customerId}&share=1&token=${encodeURIComponent(token)}`
    }
  },
  methods: {
    money,
    numberText,
    timeText,
    getCustomerClass(name) {
      if ((name || '').trim() === '\u5ba2\u6237') return 'customer-default'
      const colors = ['customer-a', 'customer-b', 'customer-c', 'customer-d', 'customer-e']
      const code = String(name || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
      return colors[code % colors.length]
    },
    goBack() {
      uni.navigateBack({ delta: 1 })
    },
    async ensureShareToken() {
      if (this.shareToken) return this.shareToken
      if (!this.order?.customerId) return ''
      const result = await request({ url: `/api/customers/${this.order.customerId}/debt-share` })
      this.shareToken = result.token
      return this.shareToken
    },
    async loadOrder() {
      this.loading = true
      this.error = ''
      try {
        const order = await request({ url: `/api/orders/${this.id}` })
        this.order = {
          ...order,
          customerClassName: this.getCustomerClass(order.customerName)
        }
        uni.setNavigationBarTitle({
          title: this.profitMode ? '其他/利润/订单利润详情' : (order.status === 'cancelled' ? '其他/回收站/订单详情' : '订单/订单详情')
        })
        if (!this.editing) this.resetEditForm()
        if (this.autoEdit && this.canEditOrder && !this.editing) {
          this.autoEdit = false
          await this.startEdit()
        }
      } catch (err) {
        this.error = err.message || this.text.loadFailed
      } finally {
        this.loading = false
      }
    },
    async loadGoods() {
      this.goodsList = await request({ url: '/api/goods' })
    },
    onEditCustomerInput() {
      if (this.editCustomerTimer) clearTimeout(this.editCustomerTimer)
      this.editCustomerTimer = setTimeout(() => this.searchEditCustomers(), 250)
    },
    async searchEditCustomers() {
      const keyword = this.editForm.customerName.trim()
      if (!keyword) {
        this.editCustomerSuggestions = []
        return
      }
      this.editCustomerSuggestions = await request({ url: `/api/customers/search?q=${encodeURIComponent(keyword)}` })
    },
    selectEditCustomer(customer) {
      this.editForm.customerName = customer.name
      this.editCustomerSuggestions = []
    },
    itemText(item) {
      const quantity = Number(item.quantity || 0)
      const commission = Number(item.commission || 0)
      const commissionTotal = quantity * commission
      const base = item.unitType === 'weight' && item.weight
        ? `${item.goodsName} ${numberText(quantity)}\u4ef6 ${numberText(item.weight)}\u65a4*${money(item.price)}`
        : `${item.goodsName} ${numberText(quantity)}\u4ef6*${money(item.price)}`
      const commissionText = commissionTotal > 0 ? `+${money(commissionTotal)}` : ''
      return `${base}${commissionText}`
    },
    itemProfit(item) {
      if (item.profit !== undefined && item.profit !== null) return Number(item.profit || 0)
      const quantity = Number(item.quantity || 0)
      const weight = Number(item.weight || 0)
      const costPrice = Number(item.costPrice || 0)
      const costAmount = item.unitType === 'weight' && weight > 0 ? weight * costPrice : quantity * costPrice
      const costCommission = quantity * Number(item.costCommission || 0)
      return Number((Number(item.subtotal || 0) - costAmount - costCommission).toFixed(2))
    },
    resetEditForm() {
      if (!this.order) return
      this.editForm = {
        customerName: this.order.customerName || '',
        createdDate: this.dateInputText(this.order.createdAt),
        createdTime: this.timeInputText(this.order.createdAt),
        items: (this.order.items || []).map(item => ({
          id: item.id,
          goodsId: item.goodsId,
          goodsName: item.goodsName,
          unitType: item.unitType,
          quantity: String(item.quantity || ''),
          weight: item.weight === null || item.weight === undefined ? '' : String(item.weight),
          price: String(item.price || ''),
          commission: String(item.commission || 0),
          subtotal: Number(item.subtotal || 0)
        }))
      }
    },
    async startEdit() {
      this.resetEditForm()
      this.editing = true
      this.goodsKeyword = ''
      this.addingGoods = false
      this.activeGoods = null
      this.newItem = {
        quantity: '1',
        weight: '',
        price: '',
        commission: ''
      }
      try {
        await this.loadGoods()
      } catch (err) {
        uni.showToast({ title: err.message || '库存读取失败', icon: 'none' })
      }
    },
    cancelEdit() {
      this.editing = false
      this.addingGoods = false
      this.activeGoods = null
      this.goodsKeyword = ''
      this.editCustomerSuggestions = []
      this.resetEditForm()
    },
    updateEditItem(item) {
      const quantity = Number(item.quantity || 0)
      const weight = Number(item.weight || 0)
      const price = Number(item.price || 0)
      const commission = Number(item.commission || 0)
      item.subtotal = item.unitType === 'weight' && weight > 0
        ? Number((weight * price + quantity * commission).toFixed(2))
        : Number((quantity * price + quantity * commission).toFixed(2))
    },
    dateInputText(value) {
      const date = new Date(value)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    timeInputText(value) {
      const date = new Date(value)
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${hour}:${minute}`
    },
    changeEditDate(event) {
      this.editForm.createdDate = event.detail.value
    },
    changeEditTime(event) {
      this.editForm.createdTime = event.detail.value
    },
    removeEditItem(index) {
      this.editForm.items.splice(index, 1)
    },
    toggleAddGoods() {
      this.addingGoods = !this.addingGoods
      if (!this.addingGoods) {
        this.activeGoods = null
        this.goodsKeyword = ''
      }
    },
    selectGoods(goods) {
      this.activeGoods = goods
      this.goodsKeyword = goods.name
      this.newItem = {
        quantity: '1',
        weight: '',
        price: String(goods.salePrice || goods.costPrice || 0),
        commission: String(goods.saleCommission || 0)
      }
    },
    addEditItem() {
      const goods = this.activeGoods
      if (!goods) return
      const quantity = Number(this.newItem.quantity || 0)
      const weight = goods.unitType === 'weight' ? Number(this.newItem.weight || 0) : 0
      const price = Number(this.newItem.price || 0)
      const commission = Number(this.newItem.commission || 0)
      if (quantity <= 0 || price <= 0) {
        uni.showToast({ title: '数量和单价必须大于0', icon: 'none' })
        return
      }
      if (goods.unitType === 'weight' && weight <= 0) {
        uni.showToast({ title: '请填写重量', icon: 'none' })
        return
      }

      this.editForm.items.push({
        goodsId: goods.id,
        goodsName: goods.name,
        unitType: goods.unitType,
        quantity: String(quantity),
        weight: goods.unitType === 'weight' && weight > 0 ? String(weight) : '',
        price: String(price),
        commission: String(commission),
        subtotal: this.newItemTotal
      })
      this.activeGoods = null
      this.goodsKeyword = ''
      this.addingGoods = false
      this.newItem = {
        quantity: '1',
        weight: '',
        price: '',
        commission: ''
      }
    },
    validateEditForm() {
      if (!this.editForm.items.length) {
        uni.showToast({ title: this.text.noItems, icon: 'none' })
        return false
      }
      const invalid = this.editForm.items.some(item => {
        const quantity = Number(item.quantity || 0)
        const weight = Number(item.weight || 0)
        const price = Number(item.price || 0)
        return quantity <= 0 || price <= 0 || (item.unitType === 'weight' && weight <= 0)
      })
      if (invalid) {
        uni.showToast({ title: '件数、重量和价格必须大于0', icon: 'none' })
        return false
      }
      return true
    },
    buildEditPayload() {
      return {
        customerName: this.editForm.customerName.trim(),
        ...(this.missedMode ? {
          createdDate: this.editForm.createdDate,
          createdTime: this.editForm.createdTime
        } : {}),
        items: this.editForm.items.map(item => ({
          id: item.id,
          goodsId: item.goodsId,
          goodsName: item.goodsName,
          unitType: item.unitType,
          quantity: Number(item.quantity || 0),
          weight: item.unitType === 'weight' ? Number(item.weight || 0) : null,
          price: Number(item.price || 0),
          commission: Number(item.commission || 0),
          subtotal: Number(item.subtotal || 0)
        }))
      }
    },
    async saveEdit() {
      if (!this.validateEditForm() || this.saving) return
      this.saving = true
      try {
        await request({
          url: `/api/orders/${this.id}`,
          method: 'PUT',
          data: this.buildEditPayload()
        })
        uni.showToast({ title: '已保存', icon: 'success' })
        this.editing = false
        this.editCustomerSuggestions = []
        await this.loadOrder()
      } finally {
        this.saving = false
      }
    },
    markPaid() {
      uni.showModal({
        title: this.text.confirmCheckout,
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/orders/${this.id}/pay`, method: 'PATCH' })
          this.loadOrder()
        }
      })
    },
    cancelOrder() {
      uni.showModal({
        title: this.text.confirmCancel,
        content: this.text.cancelTip,
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/orders/${this.id}/cancel`, method: 'PATCH' })
          this.loadOrder()
        }
      })
    },
    deleteOrder() {
      uni.showModal({
        title: this.text.confirmDelete,
        content: this.text.deleteTip,
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/orders/${this.id}`, method: 'DELETE' })
          uni.navigateBack({ delta: 1 })
        }
      })
    },
    openCustomerBill() {
      if (!this.order?.customerId) return
      uni.navigateTo({ url: `/pages/orders/debt?customerId=${this.order.customerId}` })
    },
    async printOrder() {
      if (!this.order || this.printing) return
      this.printing = true
      uni.showLoading({ title: `${this.text.printing}...` })
      try {
        await request({
          url: '/api/prints/order',
          method: 'POST',
          data: { orderId: this.id }
        })
        uni.showToast({ title: this.text.printSuccess, icon: 'success' })
      } finally {
        this.printing = false
        uni.hideLoading()
      }
    }
  }
}
</script>

<style scoped>
.head-row {
  display: flex;
  gap: 10rpx;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx;
}

.head-actions {
  display: flex;
  gap: 8rpx;
  align-items: center;
}

.head-actions .soft-button {
  height: 54rpx;
  min-height: 54rpx;
  padding: 0 14rpx;
  font-size: 24rpx;
}

.head-actions .print {
  background: #e8f6ed;
  color: #166b4e;
}

.status-text {
  min-width: 64rpx;
  color: #4d565c;
  font-size: 25rpx;
  font-weight: 900;
  text-align: right;
}

.status-text.paid {
  min-width: 150rpx;
  color: #16945f;
}

.status-text.cancelled {
  color: #e85d4f;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.content-edit-button {
  width: auto;
  height: 54rpx;
  min-height: 54rpx;
  margin: 0;
  padding: 0 22rpx;
  border-radius: 14rpx;
  background: #fff6cf;
  color: #17362f;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 54rpx;
}

.content-edit-button::after {
  display: none;
  border: 0;
}

.summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 14rpx;
  padding: 16rpx;
  background: linear-gradient(135deg, #ffffff 0%, #f2fbf4 100%);
}

.summary view {
  display: grid;
  gap: 4rpx;
  min-width: 0;
}

.strong {
  overflow: hidden;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  min-height: 42rpx;
  padding: 0 14rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #166b4e;
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

.detail-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10rpx;
  align-items: center;
  min-height: 62rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid #eef2ee;
}

.detail-text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.detail-side {
  display: grid;
  gap: 4rpx;
  text-align: right;
}

.detail-price,
.total {
  color: #16945f;
  font-weight: 900;
  text-align: right;
}

.detail-profit {
  color: #16945f;
  font-size: 23rpx;
  font-weight: 900;
}

.detail-profit.loss {
  color: #d64b3f;
}

.profit-total {
  color: #16945f;
}

.total {
  margin-top: 18rpx;
  font-size: 34rpx;
}

.edit-panel {
  padding: 18rpx;
}

.edit-field {
  display: grid;
  grid-template-columns: 68rpx minmax(0, 1fr);
  gap: 10rpx;
  align-items: center;
  min-width: 0;
  color: #243640;
  font-size: 24rpx;
  font-weight: 900;
}

.customer-edit-field {
  position: relative;
}

.edit-suggest-float {
  position: absolute;
  left: 78rpx;
  right: 0;
  top: 70rpx;
  z-index: 50;
  max-height: 176rpx;
  border: 2rpx solid #c9dcc9;
  border-radius: 14rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(24, 37, 46, 0.14);
  overflow: hidden;
}

.edit-suggest-item {
  min-height: 56rpx;
  padding: 14rpx 18rpx;
  border-bottom: 1rpx solid #eef2ee;
  color: #17362f;
  font-weight: 900;
}

.edit-date-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.picker-value {
  display: flex;
  align-items: center;
}

.edit-input {
  min-width: 0;
  min-height: 62rpx;
  padding: 0 14rpx;
}

.add-section {
  margin-top: 18rpx;
  padding: 0;
  border: 2rpx solid #c9dcc9;
  border-radius: 16rpx;
  background: #f7fbf3;
  overflow: hidden;
}

.add-section.open {
  padding: 14rpx;
}

.add-toggle-button {
  width: 100%;
  height: 72rpx;
  min-height: 72rpx;
  margin: 0;
  border-radius: 14rpx;
  background: #e8f6ed;
  color: #166b4e;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 72rpx;
}

.add-section.open .add-toggle-button {
  margin-bottom: 12rpx;
}

.add-toggle-button::after {
  display: none;
  border: 0;
}

.goods-search {
  min-height: 66rpx;
  padding: 0 16rpx;
}

.goods-scroll {
  max-height: 360rpx;
  margin-top: 12rpx;
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
}

.goods-cell {
  display: grid;
  gap: 4rpx;
  min-width: 0;
  padding: 14rpx;
  border: 2rpx solid #dce8d8;
  border-radius: 14rpx;
  background: #ffffff;
}

.goods-cell.active {
  border-color: #16945f;
  background: #e8f6ed;
}

.goods-name {
  overflow: hidden;
  color: #17362f;
  font-size: 26rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.new-item-panel {
  margin-top: 14rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #ffffff;
}

.panel-title {
  margin-bottom: 12rpx;
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
}

.add-button {
  width: 100%;
  margin-top: 14rpx;
}

.add-empty {
  padding: 16rpx 0 4rpx;
}

.edit-item {
  margin-top: 16rpx;
  padding: 14rpx;
  border: 2rpx solid #c9dcc9;
  border-radius: 16rpx;
  background: #fffef9;
}

.edit-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.edit-goods {
  overflow: hidden;
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.edit-subtotal {
  margin-top: 12rpx;
  color: #16945f;
  font-size: 28rpx;
  font-weight: 900;
  text-align: right;
}

.edit-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 18rpx;
}

.mini-delete {
  width: 60rpx;
  height: 50rpx;
  min-height: 50rpx;
  border-radius: 12rpx;
  background: #ffece8;
  color: #d64b3f;
  font-size: 24rpx;
  font-weight: 900;
}

.share-button {
  width: calc(100% - 28rpx);
  height: 78rpx;
  margin: 18rpx 14rpx 0;
  border-radius: 14rpx;
  background: #fff6cf;
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 78rpx;
  box-shadow: 0 8rpx 18rpx rgba(25, 55, 44, 0.08);
}

.share-button::after {
  display: none;
  border: 0;
}

.empty,
.error {
  color: #6b7780;
  text-align: center;
}

.error {
  color: #d64b3f;
}
</style>
