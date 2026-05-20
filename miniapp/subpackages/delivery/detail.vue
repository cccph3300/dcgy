<template>
  <view class="page delivery-detail">
    <view class="soft-card head-card">
      <button class="soft-button" @click="goBack">返回</button>
      <view class="head-actions">
        <button v-if="order" class="soft-button save" :disabled="savingImage" @click="saveSheetImage">{{ savingImage ? '生成中' : '保存图片' }}</button>
        <button v-if="canPay" class="soft-button pay" @click="payOrder">结账</button>
        <button v-if="canEdit" class="soft-button edit" @click="openEdit">修改</button>
        <button v-if="canCancel" class="soft-button danger" @click="cancelOrder">作废</button>
      </view>
    </view>

    <view v-if="loading" class="soft-card empty">正在读取送货单...</view>
    <view v-else-if="error" class="soft-card empty error">{{ error }}</view>

    <template v-else-if="order">
      <view class="soft-card summary-card">
        <view>
          <text class="muted">超市</text>
          <text class="strong">{{ order.supermarketName }}</text>
        </view>
        <view>
          <text class="muted">总价</text>
          <text class="strong amount">¥{{ money(order.totalAmount) }}</text>
        </view>
        <view>
          <text class="muted">利润</text>
          <text class="strong profit" :class="{ loss: Number(order.totalProfit || 0) < 0 }">¥{{ money(order.totalProfit) }}</text>
        </view>
        <view>
          <text class="muted">状态</text>
          <text class="status" :class="order.status">{{ statusText(order.status) }}</text>
        </view>
      </view>

      <view class="sheet-card">
        <view class="sheet-title">{{ sheetTitle }}</view>
        <view class="sheet-table">
          <view class="sheet-row sheet-head" :class="{ 'profit-mode': profitMode }">
            <text>ID</text>
            <text>水果名称</text>
            <text>数量</text>
            <text>重量</text>
            <text>价格</text>
            <text>佣金</text>
            <text>总价</text>
            <text v-if="profitMode">利润</text>
          </view>
          <view v-for="(item, index) in sheetRows" :key="index" class="sheet-row" :class="{ even: index % 2 === 1, 'profit-mode': profitMode }">
            <text class="sheet-no">{{ index + 1 }}</text>
            <text>{{ item.goodsName }}</text>
            <text>{{ numberText(item.quantity) }}</text>
            <text>{{ sheetNumber(item.weight) }}</text>
            <text>{{ sheetMoney(item.price) }}</text>
            <text>{{ sheetMoney(item.commission) }}</text>
            <text>{{ sheetMoney(item.subtotal) }}</text>
            <text v-if="profitMode" :class="{ loss: Number(item.profit || 0) < 0 }">{{ sheetMoney(item.profit) }}</text>
          </view>
        </view>
        <view class="sheet-total">
          <text class="sheet-total-time">{{ sheet.fillTime || timeText(order.createdAt) }}</text>
          <view class="sheet-total-box">
            <text>合计总价: ¥{{ money(order.totalAmount) }}</text>
          </view>
        </view>
      </view>

      <view class="soft-card totals-card">
        <view class="total-line"><text>总成本</text><text>¥{{ money(order.totalCost) }}</text></view>
        <view class="total-line"><text>总佣金</text><text>¥{{ money(order.totalCommission) }}</text></view>
        <view class="total-line profit"><text>总利润</text><text>¥{{ money(order.totalProfit) }}</text></view>
      </view>

      <canvas
        canvas-id="sheetCanvas"
        class="sheet-canvas"
        :width="canvasWidth"
        :height="canvasHeight"
        :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
      ></canvas>

      <!-- #ifdef H5 -->
      <image
        v-if="previewLoadingUrl"
        class="preview-preload-image"
        :src="previewLoadingUrl"
        mode="widthFix"
        @load="onPreviewImageLoad"
        @error="onPreviewImageError"
      ></image>
      <view v-if="previewVisible && previewImageUrl" class="image-preview-mask" @click="closePreview">
        <view class="image-preview-panel" @click.stop>
          <button class="preview-close" @click="closePreview">×</button>
          <image
            class="sheet-preview-image"
            :src="previewImageUrl"
            mode="widthFix"
          ></image>
        </view>
      </view>
      <!-- #endif -->
    </template>
  </view>
</template>

<script>
import { request, requireLogin } from '../../utils/request'
import { money, numberText, timeText } from '../../utils/format'

export default {
  data() {
    return {
      id: '',
      profitMode: false,
      order: null,
      sheet: {},
      loading: true,
      error: '',
      savingImage: false,
      canvasWidth: 375,
      canvasHeight: 520,
      previewImageUrl: '',
      previewVisible: false,
      previewLoadingUrl: ''
    }
  },
  computed: {
    canEdit() {
      return this.order && this.order.status !== 'cancelled'
    },
    canCancel() {
      return this.order && this.order.status !== 'cancelled'
    },
    canPay() {
      return this.order && this.order.status === 'active'
    },
    sheetRows() {
      const orderItems = this.order?.items || []
      const rawRows = this.sheet.rows || this.sheet.items || orderItems
      return rawRows.map((row, index) => {
        const source = orderItems[index] || {}
        const subtotal = row.subtotal ?? row.total ?? source.subtotal ?? 0
        const profit = row.profit ?? source.profit ?? this.calcItemProfit({ ...source, ...row, subtotal })
        return {
          ...source,
          ...row,
          subtotal,
          profit
        }
      })
    },
    sheetTitle() {
      const name = this.sheet.supermarketName || this.order?.supermarketName || '超市'
      return `${name}送货单`
    }
  },
  onLoad(query) {
    this.id = query.id
    this.profitMode = query.profit === '1'
    if (this.profitMode) uni.setNavigationBarTitle({ title: '其他/利润/订单利润详情' })
  },
  onShow() {
    if (requireLogin()) this.loadDetail()
  },
  methods: {
    money,
    numberText,
    timeText,
    statusText(status) {
      if (status === 'paid') return '已结'
      if (status === 'cancelled') return '已作废'
      return '未结'
    },
    goBack() {
      uni.navigateBack({ delta: 1 })
    },
    async loadDetail() {
      this.loading = true
      this.error = ''
      try {
        const [order, sheet] = await Promise.all([
          request({ url: `/api/supermarket-orders/${this.id}` }),
          request({ url: `/api/supermarket-orders/${this.id}/sheet` })
        ])
        this.order = order
        this.sheet = sheet || {}
        if (this.profitMode) uni.setNavigationBarTitle({ title: '其他/利润/订单利润详情' })
      } catch (err) {
        this.error = err.message || '送货单读取失败'
      } finally {
        this.loading = false
      }
    },
    drawText(ctx, text, x, y, maxWidth) {
      const value = String(text ?? '')
      if (value.length <= 8 || !maxWidth) {
        ctx.fillText(value, x, y, maxWidth)
        return
      }
      ctx.fillText(value.slice(0, 8), x, y, maxWidth)
    },
    sleep(ms = 0) {
      return new Promise(resolve => setTimeout(resolve, ms))
    },
    sheetMoney(value) {
      const amount = Number(value || 0)
      if (amount === 0) return '-'
      if (Math.abs(amount) >= 10000) return String(Math.round(amount))
      return money(amount)
    },
    sheetNumber(value) {
      const amount = Number(value || 0)
      if (amount === 0) return '-'
      return numberText(amount)
    },
    buildImageRows() {
      return this.sheetRows.map((item, index) => ({
        index: index + 1,
        goodsName: item.goodsName,
        quantity: numberText(item.quantity),
        weight: this.sheetNumber(item.weight),
        price: this.sheetMoney(item.price),
        commission: this.sheetMoney(item.commission),
        subtotal: this.sheetMoney(item.subtotal),
        profit: this.sheetMoney(item.profit)
      }))
    },
    calcItemProfit(item) {
      const quantity = Number(item.quantity || 0)
      const weight = Number(item.weight || 0)
      const costPrice = Number(item.costPrice || 0)
      const costAmount = item.costAmount !== undefined && item.costAmount !== null
        ? Number(item.costAmount || 0)
        : (item.unitType === 'weight' && weight > 0 ? weight * costPrice : quantity * costPrice)
      return Number((Number(item.subtotal || 0) - costAmount - Number(item.commission || 0)).toFixed(2))
    },
    getSheetImageSize() {
      const rows = this.buildImageRows()
      const width = 750
      const rowHeight = 58
      const height = 192 + rows.length * rowHeight + 86
      return { rows, width, rowHeight, height }
    },
    drawSheetCanvas(size) {
      const { rows, width, rowHeight, height } = size
      this.canvasWidth = width
      this.canvasHeight = height
      const ctx = uni.createCanvasContext('sheetCanvas', this)

      ctx.setFillStyle('#ffffff')
      ctx.fillRect(0, 0, width, height)
      ctx.setFillStyle('#245277')
      ctx.fillRect(0, 0, width, 96)
      ctx.setFillStyle('#ffffff')
      ctx.setFontSize(36)
      ctx.setTextAlign('center')
      ctx.fillText(this.sheetTitle, width / 2, 62)

      const columns = [
        { title: '号', x: 20, width: 40, align: 'center' },
        { title: '水果名称', x: 72, width: 178, align: 'left' },
        { title: '数量', x: 286, width: 60, align: 'center' },
        { title: '重量', x: 368, width: 68, align: 'center' },
        { title: '价格', x: 454, width: 76, align: 'center' },
        { title: '佣金', x: 548, width: 72, align: 'center' },
        { title: '总价', x: 710, width: 100, align: 'right' }
      ]
      if (this.profitMode) {
        columns.splice(
          0,
          columns.length,
          { title: '号', x: 20, width: 40, align: 'center' },
          { title: '水果名称', x: 72, width: 166, align: 'left' },
          { title: '数量', x: 276, width: 56, align: 'center' },
          { title: '重量', x: 352, width: 64, align: 'center' },
          { title: '价格', x: 436, width: 72, align: 'center' },
          { title: '佣金', x: 524, width: 68, align: 'center' },
          { title: '总价', x: 630, width: 86, align: 'right' },
          { title: '利润', x: 726, width: 88, align: 'right' }
        )
      }

      ctx.setFillStyle('#2b7a69')
      ctx.fillRect(0, 96, width, 56)
      ctx.setFillStyle('#ffffff')
      ctx.setFontSize(25)
      columns.forEach(column => {
        ctx.setTextAlign(column.align)
        ctx.fillText(column.title, column.x, 132)
      })

      rows.forEach((row, index) => {
        const y = 152 + index * rowHeight
        ctx.setFillStyle(index % 2 === 1 ? '#f0f5f0' : '#ffffff')
        ctx.fillRect(0, y, width, rowHeight)
        ctx.setFillStyle('#111111')
        ctx.setFontSize(24)
        const values = this.profitMode
          ? [row.index, row.goodsName, row.quantity, row.weight, row.price, row.commission, row.subtotal, row.profit]
          : [row.index, row.goodsName, row.quantity, row.weight, row.price, row.commission, row.subtotal]
        columns.forEach((column, columnIndex) => {
          ctx.setTextAlign(column.align)
          this.drawText(ctx, values[columnIndex], column.x, y + 37, column.width)
        })
      })

      const totalY = 152 + rows.length * rowHeight
      ctx.setFillStyle('#17362f')
      ctx.setFontSize(30)
      ctx.setTextAlign('left')
      ctx.fillText(this.sheet.fillTime || timeText(this.order.createdAt), 24, totalY + 48)
      ctx.setFillStyle('#fff6cf')
      ctx.fillRect(width - 360, totalY, 360, 76)
      ctx.setFillStyle('#17362f')
      ctx.setTextAlign('right')
      ctx.fillText(`合计总价: ¥${money(this.order.totalAmount)}`, width - 24, totalY + 48)
      return new Promise(resolve => {
        ctx.draw(false, async () => {
          await this.sleep(300)
          resolve({ width, height })
        })
      })
    },
    saveSheetImage() {
      if (this.savingImage || !this.order) return
      this.savingImage = true
      const size = this.getSheetImageSize()
      this.canvasWidth = size.width
      this.canvasHeight = size.height
      this.previewImageUrl = ''
      this.previewVisible = false
      this.previewLoadingUrl = ''
      this.$nextTick(async () => {
        try {
          await this.sleep(300)
          const drawnSize = await this.drawSheetCanvas(size)
          uni.canvasToTempFilePath({
            canvasId: 'sheetCanvas',
            width: drawnSize.width,
            height: drawnSize.height,
            destWidth: drawnSize.width,
            destHeight: drawnSize.height,
            success: (res) => {
              // #ifdef H5
              this.previewLoadingUrl = res.tempFilePath
              // #endif
              // #ifndef H5
              uni.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => uni.showToast({ title: '已保存到相册', icon: 'success' }),
                fail: () => uni.showToast({ title: '保存失败，请开启相册权限', icon: 'none' }),
                complete: () => {
                  this.savingImage = false
                }
              })
              // #endif
            },
            fail: () => {
              this.savingImage = false
              uni.showToast({ title: '图片生成失败', icon: 'none' })
            }
          }, this)
        } catch (err) {
          this.savingImage = false
          uni.showToast({ title: '图片生成失败', icon: 'none' })
        }
      })
    },
    onPreviewImageLoad() {
      this.previewImageUrl = this.previewLoadingUrl
      this.previewLoadingUrl = ''
      this.previewVisible = true
      this.savingImage = false
    },
    onPreviewImageError() {
      this.previewLoadingUrl = ''
      this.savingImage = false
      uni.showToast({ title: '图片生成失败', icon: 'none' })
    },
    closePreview() {
      this.previewImageUrl = ''
      this.previewVisible = false
      this.previewLoadingUrl = ''
    },
    openEdit() {
      uni.navigateTo({ url: `/subpackages/delivery/create?id=${this.id}` })
    },
    payOrder() {
      uni.showModal({
        title: '确认结账',
        content: `超市：${this.order.supermarketName}\n总金额：¥${money(this.order.totalAmount)}`,
        confirmText: '结账',
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/supermarket-orders/${this.id}/pay`, method: 'PATCH' })
          uni.showToast({ title: '已结账', icon: 'success' })
          this.loadDetail()
        }
      })
    },
    cancelOrder() {
      uni.showModal({
        title: '作废订单？',
        content: '作废后会由后端还回自家商品库存。',
        confirmText: '作废',
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: `/api/supermarket-orders/${this.id}/cancel`, method: 'PATCH' })
          uni.showToast({ title: '已作废', icon: 'success' })
          this.loadDetail()
        }
      })
    }
  }
}
</script>

<style scoped>
.head-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx;
}

.head-card .soft-button {
  height: 56rpx;
  min-height: 56rpx;
  padding: 0 18rpx;
  font-size: 24rpx;
}

.head-actions {
  display: flex;
  gap: 10rpx;
}

.edit {
  background: #fff6cf;
  color: #17362f;
}

.save {
  background: #e8f6ed;
  color: #166b4e;
}

.pay {
  background: #16945f;
  color: #ffffff;
}

.summary-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  background: linear-gradient(135deg, #ffffff 0%, #f2fbf4 100%);
}

.summary-card view {
  display: grid;
  gap: 4rpx;
}

.strong {
  overflow: hidden;
  color: #17362f;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount,
.profit {
  color: #16945f;
}

.loss {
  color: #d64b3f;
}

.status {
  width: fit-content;
  min-width: 92rpx;
  height: 44rpx;
  border-radius: 12rpx;
  background: #e8f6ed;
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 44rpx;
  text-align: center;
}

.status.unpaid {
  background: #fff6cf;
  color: #9b6b00;
}

.status.cancelled {
  background: #ffece8;
  color: #d64b3f;
}

.sheet-card {
  margin-bottom: 18rpx;
  border: 2rpx solid #c9dcc9;
  border-radius: 16rpx;
  overflow: hidden;
  background: #ffffff;
}

.sheet-title {
  padding: 20rpx;
  background: #245277;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 900;
  text-align: center;
}

.sheet-row {
  display: grid;
  grid-template-columns: 0.38fr 1.72fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr;
  min-height: 54rpx;
  align-items: center;
  padding: 0 10rpx;
  color: #111111;
  font-size: 24rpx;
}

.sheet-row.profit-mode {
  grid-template-columns: 0.36fr 1.54fr 0.7fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr;
}

.sheet-row text {
  overflow: hidden;
  padding: 0 4rpx;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-row text.loss {
  color: #d64b3f;
}

.sheet-no {
  font-size: 22rpx;
}

.sheet-head {
  background: #2b7a69;
  color: #ffffff;
  font-weight: 900;
}

.sheet-row.even {
  background: #eeeeee;
}

.sheet-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76rpx;
  background: #ffffff;
  color: #17362f;
  font-size: 28rpx;
  font-weight: 900;
}

.sheet-total-time {
  padding-left: 18rpx;
  color: #415149;
  font-size: 24rpx;
  font-weight: 800;
}

.sheet-total-box {
  display: flex;
  justify-content: flex-end;
  width: 360rpx;
  margin-left: auto;
  min-height: 76rpx;
  align-items: center;
  padding: 0 18rpx;
  background: #fff6cf;
}

.sheet-total-box text {
  text-align: right;
}

.totals-card {
  padding: 18rpx;
}

.total-line {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #eef2ee;
  color: #415149;
  font-weight: 900;
}

.total-line.profit {
  color: #16945f;
}

.empty {
  padding: 42rpx 0;
  color: #718078;
  text-align: center;
}

.error {
  color: #d64b3f;
}

.sheet-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
  opacity: 0;
  pointer-events: none;
}

.image-preview-mask {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx;
  background: rgba(0, 0, 0, 0.72);
}

.image-preview-panel {
  position: relative;
  width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: 12rpx;
  background: #ffffff;
}

.preview-close {
  position: absolute;
  right: 10rpx;
  top: 10rpx;
  z-index: 2;
  width: 56rpx;
  height: 56rpx;
  min-height: 56rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.58);
  color: #ffffff;
  font-size: 40rpx;
  line-height: 56rpx;
}

.sheet-preview-image {
  display: block;
  width: 100%;
  background: #ffffff;
}

.preview-preload-image {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 750px;
  opacity: 0;
  pointer-events: none;
}

.preview-loading {
  min-height: 360rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #415149;
  font-size: 28rpx;
  font-weight: 900;
}
</style>
