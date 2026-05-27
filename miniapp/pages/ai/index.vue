<template>
  <page-meta page-style="overflow: hidden;" />
  <view class="page ai-page" :class="{ 'keyboard-open': keyboardVisible }">
    <view class="top-bar">
      <view class="title-wrap">
        <text class="brand">东成果业</text>
        <text class="title">小东</text>
      </view>
      <view class="status-pill" :class="{ online: connected }">{{ statusText }}</view>
    </view>

    <scroll-view
      class="message-scroll"
      scroll-y
      :scroll-into-view="scrollIntoView"
      :scroll-with-animation="scrollWithAnimation"
      :show-scrollbar="false"
      :refresher-enabled="canLoadMoreHistory"
      :refresher-triggered="historyRefreshing"
      refresher-background="#f4f7ef"
      enhanced
      @refresherrefresh="onHistoryRefresh"
    >
      <view v-if="historyLoading" class="history-tip">加载中...</view>
      <view v-else-if="canLoadMoreHistory" class="history-tip">下拉加载更多</view>
      <view v-else class="history-tip">已经是最多了</view>

      <view
        v-for="message in messages"
        :id="`message-${message.id}`"
        :key="message.id"
        class="message-row"
        :class="message.role"
      >
        <view class="bubble">
          <text v-if="message.content">{{ message.content }}</text>
          <view v-if="message.loading" class="typing">小东正在处理...</view>

          <view v-if="message.action" class="action-panel">
            <view class="action-head">
              <text class="action-title">{{ message.action.title }}</text>
              <text class="action-summary">{{ message.action.summary }}</text>
            </view>

            <view v-if="message.action.kind === 'create_order'" class="draft-editor">
              <view class="draft-customer">
                <text class="draft-label">客户</text>
                <input
                  v-model="message.action.customerName"
                  class="draft-input"
                  placeholder="客户"
                  :data-action-id="message.id"
                  @input="onDraftCustomerInput"
                  @focus="searchDraftCustomers"
                />
              </view>
              <scroll-view
                v-if="message.action.customerSuggestions.length"
                class="draft-suggest-list customer-suggest-list"
                scroll-y
                enhanced
              >
                <view
                  v-for="(customer, customerIndex) in message.action.customerSuggestions"
                  :key="customer.id"
                  class="draft-suggest-item"
                  :data-action-id="message.id"
                  :data-customer-index="customerIndex"
                  @click="selectDraftCustomer"
                >
                  {{ customer.name }}
                </view>
              </scroll-view>

              <scroll-view class="editable-scroll" scroll-x :show-scrollbar="true" enhanced>
                <view class="editable-table">
                  <view class="editable-head">
                    <text>品名</text>
                    <text>件数</text>
                    <text>重量</text>
                    <text>价格</text>
                    <text>售卖佣金</text>
                    <text>小计</text>
                  </view>
                  <view v-for="(item, rowIndex) in message.action.items" :key="item.rowKey" class="editable-row" :class="{ expanded: item.goodsSuggestions.length }">
                    <view class="goods-field">
                      <input
                        v-model="item.goodsName"
                        class="draft-input goods-input"
                        placeholder="品名"
                        :data-action-id="message.id"
                        :data-row-index="rowIndex"
                        @input="onDraftGoodsInput"
                        @focus="searchDraftGoods"
                      />
                      <scroll-view
                        v-if="item.goodsSuggestions.length"
                        class="draft-suggest-list goods-suggest-list"
                        scroll-y
                        enhanced
                      >
                        <view
                          v-for="(goods, goodsIndex) in item.goodsSuggestions"
                          :key="goods.id"
                          class="draft-suggest-item"
                          :data-action-id="message.id"
                          :data-row-index="rowIndex"
                          :data-goods-index="goodsIndex"
                          @click="selectDraftGoods"
                        >
                          {{ goods.name }}
                        </view>
                      </scroll-view>
                    </view>
                    <input v-model="item.quantity" class="draft-input number-input" type="digit" :data-action-id="message.id" :data-row-index="rowIndex" @input="updateDraftItem" />
                    <input v-model="item.weight" class="draft-input number-input" type="digit" placeholder="-" :data-action-id="message.id" :data-row-index="rowIndex" @input="updateDraftItem" />
                    <input v-model="item.price" class="draft-input number-input" type="digit" :data-action-id="message.id" :data-row-index="rowIndex" @input="updateDraftItem" />
                    <input v-model="item.commission" class="draft-input number-input" type="digit" placeholder="-" :data-action-id="message.id" :data-row-index="rowIndex" @input="updateDraftItem" />
                    <view class="subtotal-cell">
                      <text>￥{{ money(item.subtotal) }}</text>
                      <button v-if="message.action.items.length > 1" class="row-delete" :data-action-id="message.id" :data-row-index="rowIndex" @click="removeDraftItem">删</button>
                    </view>
                  </view>
                </view>
              </scroll-view>
            </view>

            <view v-else-if="message.action.kind === 'create_supplier_entry'" class="entry-draft-editor">
              <view class="entry-form-grid">
                <view class="entry-field suggest-field">
                  <text>货主</text>
                  <input
                    v-model="message.action.supplierEntry.supplierName"
                    class="draft-input"
                    placeholder="货主"
                    :data-action-id="message.id"
                    @input="onSupplierEntrySupplierInput"
                    @focus="searchSupplierEntrySuppliers"
                  />
                  <scroll-view
                    v-if="message.action.supplierEntry.supplierSuggestions.length"
                    class="draft-suggest-list entry-suggest-list"
                    scroll-y
                    enhanced
                  >
                    <view
                      v-for="(supplier, supplierIndex) in message.action.supplierEntry.supplierSuggestions"
                      :key="supplier.id"
                      class="draft-suggest-item"
                      :data-action-id="message.id"
                      :data-supplier-index="supplierIndex"
                      @click="selectSupplierEntrySupplier"
                    >
                      {{ supplier.name }}
                    </view>
                  </scroll-view>
                </view>
                <view class="entry-field suggest-field">
                  <text>品名</text>
                  <input
                    v-model="message.action.supplierEntry.goodsName"
                    class="draft-input"
                    placeholder="品名"
                    :data-action-id="message.id"
                    @input="onSupplierEntryGoodsInput"
                    @focus="searchSupplierEntryGoods"
                  />
                  <scroll-view
                    v-if="message.action.supplierEntry.goodsSuggestions.length"
                    class="draft-suggest-list entry-suggest-list"
                    scroll-y
                    enhanced
                  >
                    <view
                      v-for="(goods, goodsIndex) in message.action.supplierEntry.goodsSuggestions"
                      :key="goods.id"
                      class="draft-suggest-item"
                      :data-action-id="message.id"
                      :data-goods-index="goodsIndex"
                      @click="selectSupplierEntryGoods"
                    >
                      {{ goods.name }}
                    </view>
                  </scroll-view>
                </view>
                <view class="entry-field">
                  <text>计费</text>
                  <picker :range="entryUnitOptions" range-key="label" :value="message.action.supplierEntry.unitIndex" :data-action-id="message.id" @change="changeSupplierEntryUnit">
                    <view class="picker-value">{{ message.action.supplierEntry.unitType === 'weight' ? '按斤' : '按件' }}</view>
                  </picker>
                </view>
                <view class="entry-field">
                  <text>件数</text>
                  <input v-model="message.action.supplierEntry.quantity" class="draft-input" type="digit" :data-action-id="message.id" @input="updateSupplierEntryDraft" />
                </view>
                <view class="entry-field">
                  <text>重量</text>
                  <input v-model="message.action.supplierEntry.weight" class="draft-input" type="digit" placeholder="斤" :data-action-id="message.id" @input="updateSupplierEntryDraft" />
                </view>
                <view class="entry-field">
                  <text>总金额</text>
                  <input v-model="message.action.supplierEntry.totalAmount" class="draft-input" type="digit" :data-action-id="message.id" @input="updateSupplierEntryDraft" />
                </view>
                <view class="entry-field">
                  <text>拿货总佣金</text>
                  <input v-model="message.action.supplierEntry.totalCommission" class="draft-input" type="digit" :data-action-id="message.id" @input="updateSupplierEntryDraft" />
                </view>
                <view class="entry-field">
                  <text>成本</text>
                  <input v-model="message.action.supplierEntry.costPrice" class="draft-input" type="digit" disabled />
                </view>
                <view class="entry-field">
                  <text>售卖价</text>
                  <input v-model="message.action.supplierEntry.salePrice" class="draft-input" type="digit" />
                </view>
              </view>
            </view>

            <view v-else class="table-wrap">
              <view class="table-row table-head" :class="message.action.tableClass">
                <text v-for="col in message.action.table.columns" :key="col" class="table-cell">{{ col }}</text>
              </view>
              <view v-for="(row, rowIndex) in message.action.table.rows" :key="rowIndex" class="table-row" :class="message.action.tableClass">
                <text v-for="(cell, cellIndex) in row" :key="`${rowIndex}-${cellIndex}`" class="table-cell">{{ cell }}</text>
              </view>
            </view>

            <view v-if="message.action.kind === 'query_orders' && message.action.orders && message.action.orders.length" class="order-action-list">
              <view v-for="order in message.action.orders" :key="order.id" class="order-action-row">
                <text class="order-action-text">{{ order.customerName }} ￥{{ money(order.totalAmount) }}</text>
                <button class="mini-action edit" :data-order-id="order.id" @click="editOrder">改单</button>
                <button class="mini-action delete" :data-action-id="message.id" :data-order-id="order.id" @click="deleteOrder">删单</button>
              </view>
            </view>

            <view v-if="message.action.kind === 'goods_mutation'" class="mutation-footer">
              <text class="mutation-warning">请核对后再执行，确认前不会修改库存。</text>
              <button class="action-button danger" :disabled="message.action.submitting" :data-action-id="message.id" @click="confirmGoodsMutation">
                {{ message.action.submitting ? '执行中' : '确认操作' }}
              </button>
            </view>

            <view v-if="message.action.kind === 'create_order'" class="action-footer">
              <view class="action-meta">
                <text>合计 ￥{{ money(message.action.totalAmount) }}</text>
                <text>共 {{ message.action.rowCount }} 项</text>
              </view>
              <view class="action-button-row">
                <button class="action-button primary" :disabled="message.action.submitting" :data-action-id="message.id" @click="confirmDraft">
                  {{ message.action.submitting ? '出单中' : '确认出单' }}
                </button>
                <button class="action-button print" :disabled="message.action.submitting" :data-action-id="message.id" @click="confirmDraftAndPrint">
                  确认并打印
                </button>
              </view>
            </view>

            <view v-if="message.action.kind === 'create_supplier_entry'" class="action-footer">
              <view class="action-meta">
                <text>合计 ￥{{ money(message.action.supplierEntry.totalAmount) }}</text>
                <text>{{ message.action.supplierEntry.unitType === 'weight' ? '按斤入账' : '按件入账' }}</text>
              </view>
              <button class="action-button primary" :disabled="message.action.submitting" :data-action-id="message.id" @click="confirmSupplierEntryDraft">
                {{ message.action.submitting ? '入账中' : '确认入账' }}
              </button>
            </view>
          </view>
        </view>
      </view>

      <view id="message-bottom" class="message-bottom"></view>
    </scroll-view>

    <view class="composer-shell" :class="{ lifted: keyboardVisible }">
      <view class="composer-card">
        <view v-if="composerMode === 'text'" class="input-row">
          <textarea
            class="text-input"
            v-model="inputText"
            placeholder="先说内容，再点发送"
            :maxlength="100"
            auto-height
            :adjust-position="true"
            :show-confirm-bar="false"
            :cursor-spacing="18"
          ></textarea>
          <view v-if="canSendText" class="send-button" :class="{ disabled: busy }" @click="sendText">
            <image class="composer-icon" src="/static/ai/send.png" mode="aspectFit" />
          </view>
          <view class="voice-toggle-button" @click="switchToVoiceMode">
            <image class="composer-icon" src="/static/ai/voice.png" mode="aspectFit" />
          </view>
        </view>

        <view v-else class="voice-row">
          <view
            v-if="voiceSupported"
            class="voice-button"
            :class="{ recording, cancelled: cancelledRecording, recognizing }"
            @touchstart.stop.prevent="onVoiceTouchStart"
            @touchmove.stop.prevent="onVoiceTouchMove"
            @touchend.stop.prevent="onVoiceTouchEnd"
            @touchcancel.stop.prevent="onVoiceTouchCancel"
            @mousedown.stop.prevent="onVoiceMouseDown"
          >
            <text class="voice-main">{{ voiceMainText }}</text>
            <text v-if="voiceSubText" class="voice-sub">{{ voiceSubText }}</text>
          </view>
          <view class="keyboard-button" @click="switchToTextMode">
            <image class="composer-icon" src="/static/ai/keyboard.png" mode="aspectFit" />
          </view>
        </view>
      </view>
    </view>

    <view
      v-if="voiceOverlayVisible"
      class="voice-record-mask"
      :class="{ cancel: cancelledRecording }"
      @touchmove.stop.prevent="onVoiceTouchMove"
      @touchend.stop.prevent="onVoiceTouchEnd"
      @touchcancel.stop.prevent="onVoiceTouchCancel"
    >
      <view class="voice-record-bubble" :class="{ cancel: cancelledRecording }">
        <view class="wave-bars">
          <text v-for="bar in voiceBars" :key="bar" class="wave-bar"></text>
        </view>
      </view>
      <view class="voice-record-panel">
        <view class="voice-record-hint">{{ voiceOverlayHint }}</view>
        <view class="voice-record-actions">
          <view class="voice-record-action cancel-action" :class="{ active: cancelledRecording }">
            <text>取消</text>
          </view>
          <view class="voice-record-action text-action" :class="{ active: !cancelledRecording }">
            <text>滑到这里 转文字</text>
          </view>
        </view>
        <view class="voice-record-bottom">{{ cancelledRecording ? '松手 取消' : '松开 识别' }}</view>
      </view>
    </view>
  </view>
</template>

<script>
import {
  confirmAiOperation,
  connectAiSocket,
  fetchAiMessages,
  inferVoiceFormat,
  readBlobAsBase64,
  readFileAsBase64,
  sendAiMessage,
  sendAiMessageHttp,
  speechToText
} from '../../utils/ai'
import { request, requireLogin } from '../../utils/request'
import { money } from '../../utils/format'

export default {
  data() {
    return {
      maxMessages: 50,
      socketTask: null,
      socketFailed: false,
      connected: false,
      busy: false,
      recognizing: false,
      recording: false,
      recorder: null,
      voiceSupported: true,
      composerMode: 'voice',
      inputText: '',
      messages: [],
      activeAssistantId: null,
      messageId: 1,
      scrollIntoView: '',
      scrollWithAnimation: true,
      historyLoading: false,
      historyRefreshing: false,
      historyLoaded: false,
      hasMoreHistory: false,
      nextBeforeId: null,
      historyLoadLocked: false,
      historyLoadUnlockTimer: null,
      aiTimeoutTimer: null,
      scrollReleaseTimer: null,
      keyboardVisible: false,
      keyboardHeight: 0,
      keyboardHeightHandler: null,
      touchStartY: 0,
      touchStartX: 0,
      touchCancelThreshold: 72,
      touchCancelXThreshold: 110,
      touchActive: false,
      cancelledRecording: false,
      mouseActive: false,
      goodsList: [],
      goodsLoaded: false,
      draftCustomerTimer: null,
      draftGoodsTimer: null,
      supplierEntrySupplierTimer: null,
      supplierEntryGoodsTimer: null,
      recordStartTimer: null,
      h5MediaRecorder: null,
      h5RecordChunks: [],
      h5RecordStream: null,
      voiceOverlayVisible: false,
      voiceBars: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      entryUnitOptions: [
        { label: '按件', value: 'qty' },
        { label: '按斤', value: 'weight' }
      ]
    }
  },
  computed: {
    statusText() {
      if (this.recording) return '录音中'
      if (this.recognizing) return '识别中'
      if (this.busy) return '处理中'
      return this.connected ? '已连接' : '可用'
    },
    voiceMainText() {
      if (this.recognizing) return '识别中...'
      if (this.recording) return this.cancelledRecording ? '松手取消' : '松手识别'
      return '按住说话'
    },
    voiceSubText() {
      if (this.recognizing) return '语音会回填到输入框'
      if (this.recording) return '上滑取消'
      return ''
    },
    voiceOverlayHint() {
      if (this.cancelledRecording) return '松手 取消'
      return '松手 识别文字'
    },
    canSendText() {
      return !!String(this.inputText || '').trim()
    },
    canLoadMoreHistory() {
      return this.hasMoreHistory && this.messages.length < this.maxMessages
    },
  },
  onShow() {
    if (!requireLogin()) return
    this.refreshVoiceSupport()
    this.openSocket()
    this.initRecorder()
    if (!this.historyLoaded) this.loadLatestMessages()
    // #ifdef MP-WEIXIN || APP-PLUS
    if (!this.keyboardHeightHandler && typeof uni.onKeyboardHeightChange === 'function') {
      this.keyboardHeightHandler = (res) => {
        const height = Number(res?.height || 0)
        this.keyboardHeight = height
        this.keyboardVisible = height > 0
        if (height > 0) this.scrollToBottom(true)
      }
      uni.onKeyboardHeightChange(this.keyboardHeightHandler)
    }
    // #endif
  },
  onHide() {
    this.closeSocket()
    this.stopRecordSilently()
  },
  onUnload() {
    this.closeSocket()
    this.stopRecordSilently()
    if (this.historyLoadUnlockTimer) {
      clearTimeout(this.historyLoadUnlockTimer)
      this.historyLoadUnlockTimer = null
    }
    if (this.scrollReleaseTimer) {
      clearTimeout(this.scrollReleaseTimer)
      this.scrollReleaseTimer = null
    }
    if (this.draftCustomerTimer) {
      clearTimeout(this.draftCustomerTimer)
      this.draftCustomerTimer = null
    }
    if (this.draftGoodsTimer) {
      clearTimeout(this.draftGoodsTimer)
      this.draftGoodsTimer = null
    }
    if (this.supplierEntrySupplierTimer) {
      clearTimeout(this.supplierEntrySupplierTimer)
      this.supplierEntrySupplierTimer = null
    }
    if (this.supplierEntryGoodsTimer) {
      clearTimeout(this.supplierEntryGoodsTimer)
      this.supplierEntryGoodsTimer = null
    }
    // #ifdef MP-WEIXIN || APP-PLUS
    if (this.keyboardHeightHandler && typeof uni.offKeyboardHeightChange === 'function') {
      uni.offKeyboardHeightChange(this.keyboardHeightHandler)
      this.keyboardHeightHandler = null
    }
    // #endif
  },
  methods: {
    money,
    refreshVoiceSupport() {
      // #ifdef H5
      this.voiceSupported = !!(typeof navigator !== 'undefined' && navigator.mediaDevices && typeof MediaRecorder !== 'undefined')
      // #endif
      // #ifdef APP-PLUS || MP-WEIXIN
      this.voiceSupported = true
      // #endif
    },
    switchToTextMode() {
      this.composerMode = 'text'
    },
    switchToVoiceMode() {
      this.composerMode = 'voice'
    },
    openSocket() {
      if (this.socketTask) return
      this.socketFailed = false
      this.socketTask = connectAiSocket({
        onReady: () => {
          this.connected = true
          this.socketFailed = false
        },
        onStart: () => {
          this.busy = true
        },
        onDelta: (payload) => {
          this.appendAssistantDelta(payload)
        },
        onDone: () => {
          this.finishAssistant()
        },
        onError: () => {
          this.socketFailed = true
          this.connected = false
        },
        onClose: () => {
          this.connected = false
          this.socketTask = null
        }
      })
    },
    closeSocket() {
      if (!this.socketTask) return
      this.socketTask.close({})
      this.socketTask = null
      this.connected = false
    },
    normalizeHistoryMessage(item) {
      return {
        id: `history-${item.id}`,
        role: item.role,
        content: item.content || '',
        loading: false,
        persisted: true,
        recordId: item.id,
        action: null
      }
    },
    async loadLatestMessages() {
      if (this.historyLoading) return
      this.historyLoading = true
      try {
        const data = await fetchAiMessages({ limit: 10 })
        const items = Array.isArray(data.items) ? data.items : []
        this.messages = items.slice(-10).map(this.normalizeHistoryMessage)
        this.hasMoreHistory = !!data.hasMore && this.messages.length < this.maxMessages
        this.nextBeforeId = data.nextBeforeId || null
        this.historyLoaded = true
        this.scrollToBottom(true)
      } catch (err) {
        uni.showToast({ title: err?.message || '加载小东记录失败', icon: 'none' })
      } finally {
        this.historyLoading = false
      }
    },
    async loadMoreMessages() {
      if (this.historyLoading || this.historyLoadLocked || !this.canLoadMoreHistory || !this.nextBeforeId) return
      this.lockHistoryLoad()
      const anchorId = this.messages[0]?.id || 'message-bottom'
      this.historyLoading = true
      try {
        const data = await fetchAiMessages({ beforeId: this.nextBeforeId, limit: 10 })
        const items = Array.isArray(data.items) ? data.items : []
        const olderMessages = items.map(this.normalizeHistoryMessage)
        const existingKeys = new Set(this.messages.map(item => item.recordId || item.id))
        const uniqueOlderMessages = olderMessages.filter(item => !existingKeys.has(item.recordId || item.id))
        this.messages = [...uniqueOlderMessages, ...this.messages].slice(0, this.maxMessages)
        this.hasMoreHistory = !!data.hasMore && this.messages.length < this.maxMessages
        this.nextBeforeId = data.nextBeforeId || null
        this.$nextTick(() => {
          this.scrollIntoView = anchorId
          setTimeout(() => {
            this.scrollIntoView = anchorId
          }, 20)
        })
      } catch (err) {
        uni.showToast({ title: err?.message || '加载小东记录失败', icon: 'none' })
      } finally {
        this.historyLoading = false
        this.historyRefreshing = false
      }
    },
    async onHistoryRefresh() {
      if (!this.canLoadMoreHistory || !this.nextBeforeId) {
        this.historyRefreshing = false
        return
      }
      this.historyRefreshing = true
      await this.loadMoreMessages()
    },
    lockHistoryLoad() {
      this.historyLoadLocked = true
      if (this.historyLoadUnlockTimer) {
        clearTimeout(this.historyLoadUnlockTimer)
      }
      this.historyLoadUnlockTimer = setTimeout(() => {
        this.historyLoadLocked = false
        this.historyLoadUnlockTimer = null
      }, 900)
    },
    initRecorder() {
      if (!this.voiceSupported) return
      if (typeof uni.getRecorderManager !== 'function') return
      if (this.recorder) return
      this.recorder = uni.getRecorderManager()
      this.recorder.onStop(async (res) => {
        const cancelled = this.cancelledRecording
        this.recording = false
        this.cancelledRecording = false
        this.voiceOverlayVisible = false
        if (cancelled) return
        await this.handleNativeRecordStop(res?.tempFilePath)
      })
      this.recorder.onError((err) => {
        this.recording = false
        this.recognizing = false
        this.cancelledRecording = false
        this.voiceOverlayVisible = false
        this.resetH5Record()
        uni.showToast({ title: err?.errMsg || '录音失败', icon: 'none' })
      })
    },
    ensureRecordPermission() {
      return new Promise((resolve, reject) => {
        // #ifdef MP-WEIXIN
        uni.getSetting({
          success: (setting) => {
            if (setting.authSetting['scope.record']) {
              resolve(true)
              return
            }
            uni.authorize({
              scope: 'scope.record',
              success: () => resolve(true),
              fail: () => {
                uni.showModal({
                  title: '需要麦克风权限',
                  content: '请在设置里允许麦克风后再使用语音输入',
                  confirmText: '去设置',
                  cancelText: '取消',
                  success: (res) => {
                    if (!res.confirm) {
                      reject(new Error('未开启麦克风权限'))
                      return
                    }
                    uni.openSetting({
                      success: (result) => {
                        if (result.authSetting['scope.record']) {
                          resolve(true)
                        } else {
                          reject(new Error('未开启麦克风权限'))
                        }
                      },
                      fail: () => reject(new Error('未开启麦克风权限'))
                    })
                  }
                })
              }
            })
          },
          fail: () => resolve(true)
        })
        // #endif

        // #ifdef APP-PLUS
        const permission = 'android.permission.RECORD_AUDIO'
        if (typeof plus !== 'undefined' && plus.android?.requestPermissions) {
          plus.android.requestPermissions([permission], (result) => {
            const denied = [...(result.deniedAlways || []), ...(result.deniedPresent || [])]
            if (denied.includes(permission)) {
              reject(new Error('未开启麦克风权限'))
              return
            }
            resolve(true)
          }, () => reject(new Error('麦克风权限申请失败')))
          return
        }
        resolve(true)
        // #endif

        // #ifdef H5
        resolve(true)
        // #endif
      })
    },
    clearRecordStartTimer() {
      if (this.recordStartTimer) {
        clearTimeout(this.recordStartTimer)
        this.recordStartTimer = null
      }
    },
    getEventPoint(event) {
      const touch = event?.touches?.[0] || event?.changedTouches?.[0] || event
      return {
        x: touch?.clientX ?? 0,
        y: touch?.clientY ?? 0
      }
    },
    onVoiceTouchStart(event) {
      this.startVoicePress(this.getEventPoint(event))
    },
    onVoiceTouchMove(event) {
      if (!this.touchActive || !this.recording) return
      this.updateVoiceCancelState(this.getEventPoint(event))
    },
    onVoiceTouchEnd() {
      this.endVoicePress()
    },
    onVoiceTouchCancel() {
      this.cancelVoicePress()
    },
    onVoiceMouseDown(event) {
      if (event?.button !== 0) return
      this.mouseActive = true
      this.startVoicePress(this.getEventPoint(event))
      this.bindMouseListeners()
    },
    onWindowMouseMove(event) {
      if (!this.mouseActive || !this.recording) return
      this.updateVoiceCancelState(this.getEventPoint(event))
    },
    onWindowMouseUp() {
      if (!this.mouseActive) return
      this.mouseActive = false
      this.endVoicePress()
      this.unbindMouseListeners()
    },
    onWindowMouseLeave() {
      if (!this.mouseActive) return
      this.mouseActive = false
      this.cancelVoicePress()
      this.unbindMouseListeners()
    },
    bindMouseListeners() {
      // #ifdef H5
      if (typeof window === 'undefined') return
      window.addEventListener('mousemove', this.onWindowMouseMove)
      window.addEventListener('mouseup', this.onWindowMouseUp)
      window.addEventListener('blur', this.onWindowMouseLeave)
      // #endif
    },
    unbindMouseListeners() {
      // #ifdef H5
      if (typeof window === 'undefined') return
      window.removeEventListener('mousemove', this.onWindowMouseMove)
      window.removeEventListener('mouseup', this.onWindowMouseUp)
      window.removeEventListener('blur', this.onWindowMouseLeave)
      // #endif
    },
    updateVoiceCancelState(point) {
      const deltaY = this.touchStartY - point.y
      const deltaX = this.touchStartX - point.x
      const nextCancelled = deltaY > this.touchCancelThreshold || deltaX > this.touchCancelXThreshold
      if (nextCancelled !== this.cancelledRecording) {
        this.vibratePhone(nextCancelled ? 'heavy' : 'medium')
      }
      this.cancelledRecording = nextCancelled
    },
    startVoicePress(point) {
      if (!this.voiceSupported || this.busy || this.recognizing || this.recording) return
      this.touchActive = true
      this.cancelledRecording = false
      this.voiceOverlayVisible = true
      this.touchStartX = point?.x || 0
      this.touchStartY = point?.y || 0
      this.clearRecordStartTimer()
      this.vibratePhone('medium')
      this.recordStartTimer = setTimeout(() => {
        if (!this.touchActive) return
        this.beginVoiceRecord()
      }, 60)
    },
    endVoicePress() {
      this.clearRecordStartTimer()
      if (!this.touchActive) return
      this.touchActive = false
      if (!this.recording) {
        this.voiceOverlayVisible = false
        return
      }
      if (this.cancelledRecording) {
        this.cancelVoicePress()
      } else {
        this.vibratePhone('light')
        this.stopVoiceRecord()
      }
    },
    cancelVoicePress() {
      this.clearRecordStartTimer()
      this.touchActive = false
      if (this.recording) {
        this.cancelledRecording = true
        this.vibratePhone('heavy')
        this.stopVoiceRecord()
      } else {
        this.cancelledRecording = false
        this.voiceOverlayVisible = false
      }
      this.unbindMouseListeners()
    },
    vibratePhone(type = 'medium') {
      if (typeof uni.vibrateShort === 'function') {
        uni.vibrateShort({ type })
        return
      }
      if (typeof uni.vibrateLong === 'function') {
        uni.vibrateLong({})
      }
    },
    beginVoiceRecord() {
      if (this.recording || this.recognizing) return
      this.initRecorder()
      // #ifdef H5
      this.startH5Record()
      return
      // #endif
      this.startNativeRecord()
    },
    getNativeRecordOptions() {
      const options = {
        duration: 60000
      }
      // #ifdef APP-PLUS
      const systemInfo = uni.getSystemInfoSync ? uni.getSystemInfoSync() : {}
      const platform = String(systemInfo.platform || '').toLowerCase()
      if (platform === 'ios') {
        // iOS 对 encodeBitRate 支持不稳定，只传通用参数，避免录音启动时报 not applicable。
        options.format = 'aac'
      } else {
        options.sampleRate = 16000
        options.numberOfChannels = 1
        options.encodeBitRate = 96000
        options.format = 'mp3'
      }
      // #endif
      // #ifdef MP-WEIXIN
      const wxSystemInfo = uni.getSystemInfoSync ? uni.getSystemInfoSync() : {}
      const wxPlatform = String(wxSystemInfo.platform || '').toLowerCase()
      options.sampleRate = 16000
      options.numberOfChannels = 1
      options.format = 'aac'
      if (wxPlatform !== 'ios') {
        options.encodeBitRate = 96000
      }
      // #endif
      return options
    },
    getNativeVoiceFormat(filePath) {
      return inferVoiceFormat(filePath || 'record.aac')
    },
    startNativeRecord() {
      this.ensureRecordPermission()
        .then(() => {
          this.initRecorder()
          if (!this.recorder || typeof this.recorder.start !== 'function') {
            this.voiceOverlayVisible = false
            uni.showToast({ title: '当前设备不支持录音', icon: 'none' })
            return
          }
          this.recording = true
          this.cancelledRecording = false
          this.voiceOverlayVisible = true
          this.recorder.start(this.getNativeRecordOptions())
        })
        .catch((err) => {
          this.recording = false
          this.voiceOverlayVisible = false
          this.clearRecordStartTimer()
          uni.showToast({ title: err?.message || '麦克风权限被拒绝', icon: 'none' })
        })
    },
    async startH5Record() {
      // #ifdef H5
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
        uni.showToast({ title: '当前浏览器不支持语音录制', icon: 'none' })
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mimeTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/ogg',
          'audio/mp4'
        ]
        const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ''
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

        this.h5RecordStream = stream
        this.h5RecordChunks = []
        this.h5MediaRecorder = recorder
        this.recording = true
        this.cancelledRecording = false
        this.voiceOverlayVisible = true

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.h5RecordChunks.push(event.data)
          }
        }
        recorder.onstop = async () => {
          const blob = new Blob(this.h5RecordChunks, { type: recorder.mimeType || 'audio/webm' })
          const cancelled = this.cancelledRecording
          this.resetH5Record()
          this.recording = false
          this.cancelledRecording = false
          this.voiceOverlayVisible = false
          if (cancelled) return
          await this.handleH5RecordStop(blob)
        }
        recorder.onerror = () => {
          this.recording = false
          this.cancelledRecording = false
          this.voiceOverlayVisible = false
          this.resetH5Record()
          uni.showToast({ title: '录音失败', icon: 'none' })
        }

        recorder.start()
      } catch (err) {
        this.recording = false
        this.voiceOverlayVisible = false
        this.resetH5Record()
        uni.showToast({ title: err?.message || '无法启动语音录制', icon: 'none' })
      }
      // #endif
    },
    stopVoiceRecord() {
      if (!this.recording) {
        this.touchActive = false
        this.clearRecordStartTimer()
        return
      }
      if (this.h5MediaRecorder && typeof this.h5MediaRecorder.stop === 'function') {
        this.h5MediaRecorder.stop()
        return
      }
      if (this.recorder && typeof this.recorder.stop === 'function') {
        this.recorder.stop()
      }
    },
    stopRecordSilently() {
      this.clearRecordStartTimer()
      this.touchActive = false
      this.mouseActive = false
      this.cancelledRecording = false
      this.voiceOverlayVisible = false
      this.unbindMouseListeners()
      if (this.recording) {
        this.stopVoiceRecord()
      } else {
        this.resetH5Record()
      }
      this.recording = false
      this.recognizing = false
      this.voiceOverlayVisible = false
    },
    resetH5Record() {
      if (this.h5RecordStream && typeof this.h5RecordStream.getTracks === 'function') {
        this.h5RecordStream.getTracks().forEach((track) => track.stop())
      }
      this.h5RecordStream = null
      this.h5MediaRecorder = null
      this.h5RecordChunks = []
    },
    async handleH5RecordStop(blob) {
      if (!blob || !blob.size) return
      this.recognizing = true
      this.voiceOverlayVisible = false
      uni.showLoading({ title: '识别中...' })
      try {
        const audioBase64 = await readBlobAsBase64(blob)
        const text = await this.requestSpeechText(audioBase64, inferVoiceFormat('', blob.type))
        this.fillSpeechText(text)
      } catch (err) {
        uni.showToast({ title: err?.message || '语音识别失败', icon: 'none' })
      } finally {
        this.recognizing = false
        uni.hideLoading()
      }
    },
    async handleNativeRecordStop(filePath) {
      if (!filePath) return
      this.recognizing = true
      this.voiceOverlayVisible = false
      uni.showLoading({ title: '识别中...' })
      try {
        const audioBase64 = await readFileAsBase64(filePath)
        const text = await this.requestSpeechText(audioBase64, this.getNativeVoiceFormat(filePath))
        this.fillSpeechText(text)
      } catch (err) {
        uni.showToast({ title: err?.message || '语音识别失败', icon: 'none' })
      } finally {
        this.recognizing = false
        uni.hideLoading()
      }
    },
    async requestSpeechText(audioBase64, voiceFormat) {
      const data = await speechToText({
        audioBase64,
        voiceFormat
      })
      return String(data?.text || '').trim()
    },
    fillSpeechText(text) {
      const normalized = String(text || '').trim()
      if (!normalized) {
        uni.showToast({ title: '未识别到有效内容', icon: 'none' })
        return
      }
      this.inputText = normalized
      this.composerMode = 'text'
      uni.showToast({ title: '已回填到输入框', icon: 'none' })
    },
    async sendText() {
      const content = this.inputText.trim()
      if (!content || this.busy) return
      this.openSocket()

      this.inputText = ''
      this.addMessage('user', content)
      const assistant = this.addMessage('assistant', '', true)
      this.activeAssistantId = assistant.id
      this.busy = true
      this.keepRecentMessages()
      this.startAiTimeout()
      this.scrollToBottom(true)

      try {
        const history = this.buildHistory()
        const context = this.buildAiContext()
        if (this.socketTask && !this.socketFailed) {
          await sendAiMessage(this.socketTask, history, content, context)
        } else {
          await this.sendByHttp(history, content, context)
        }
      } catch (err) {
        try {
          await this.sendByHttp(this.buildHistory(), content, this.buildAiContext())
        } catch (httpErr) {
          this.failAssistant(httpErr?.message || err?.message || '发送失败')
        }
      }
    },
    async sendByHttp(messages, content, context) {
      const result = await sendAiMessageHttp(messages, content, context)
      this.appendAssistantDelta({
        content: result?.content || '',
        action: result?.action || null,
        final: true
      })
      this.finishAssistant()
    },
    buildHistory() {
      return this.messages
        .filter((item) => item.content && !item.loading)
        .slice(-10)
        .map((item) => ({
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: item.content
        }))
    },
    buildAiContext() {
      const draftMessage = [...this.messages].reverse().find(item => item.action && item.action.kind === 'create_order')
      const action = draftMessage?.action
      if (!action) return {}
      return {
        pendingDraft: {
          operation: action.operation || 'create_order',
          customerName: String(action.customerName || '').trim(),
          targetOrder: action.targetOrder || null,
          items: action.items.map(item => ({
            goodsId: Number(item.goodsId || 0),
            goodsName: String(item.goodsName || ''),
            unitType: item.unitType === 'weight' ? 'weight' : 'qty',
            quantity: Number(item.quantity || 0),
            weight: item.weight === '' ? null : Number(item.weight || 0),
            price: Number(item.price || 0),
            commission: item.commission === '' ? null : Number(item.commission || 0)
          }))
        }
      }
    },
    addMessage(role, content, loading = false, action = null) {
      const message = {
        id: this.messageId++,
        role,
        content,
        loading,
        action
      }
      this.messages.push(message)
      this.scrollToBottom()
      return message
    },
    appendAssistantDelta(payload) {
      const message = this.messages.find((item) => item.id === this.activeAssistantId)
      if (!message) return

      if (typeof payload === 'string') {
        message.content += payload
        message.loading = false
        this.scrollToBottom(true)
        return
      }

      const content = String(payload?.content || '')
      if (content) {
        if (payload?.final && message.content) {
          message.content = this.mergeFinalAssistantContent(message.content, content)
        } else {
          message.content += content
        }
      }
      if (payload?.action) message.action = this.normalizeAction(payload.action)
      if (payload?.final) message.loading = false
      this.scrollToBottom(true)
    },
    mergeFinalAssistantContent(current, finalContent) {
      const currentText = String(current || '')
      const finalText = String(finalContent || '')
      if (!currentText) return finalText
      if (!finalText) return currentText
      if (finalText.includes(currentText) || currentText.includes(finalText)) return finalText
      return currentText
    },
    normalizeAction(action) {
      if (!action) return null
      const table = action.table || { title: '', columns: [], rows: [] }
      const tableColumnCount = Math.max(1, Number(table.columns?.length || 1))
      const tableClass = `cols-${Math.min(tableColumnCount, 7)}`
      if (action.kind === 'create_order') {
        const draft = action.draft || {}
        const items = Array.isArray(draft.items) ? draft.items.map(item => this.buildDraftRow(item)) : []
        const normalized = {
          ...action,
          submitting: false,
          table,
          tableClass,
          customerName: draft.customerName || '客户',
          customerId: null,
          customerSuggestions: [],
          items
        }
        this.refreshDraftTotals(normalized)
        return normalized
      }
      if (action.kind === 'create_supplier_entry') {
        const entry = action.draft || {}
        const normalized = {
          ...action,
          submitting: false,
          table,
          tableClass,
          supplierEntry: this.buildSupplierEntryDraft(entry)
        }
        this.refreshSupplierEntryDraft(normalized)
        return normalized
      }
      return {
        ...action,
        submitting: false,
        table,
        tableClass
      }
    },
    finishAssistant() {
      this.clearAiTimeout()
      const message = this.messages.find((item) => item.id === this.activeAssistantId)
      if (message) message.loading = false
      this.activeAssistantId = null
      this.busy = false
      this.keepRecentMessages()
      this.scrollToBottom(true)
    },
    failAssistant(messageText) {
      this.clearAiTimeout()
      const message = this.messages.find((item) => item.id === this.activeAssistantId)
      const normalized = this.normalizeAiError(messageText)
      if (message) {
        message.content = normalized
        message.loading = false
      } else {
        this.addMessage('assistant', normalized)
      }
      this.activeAssistantId = null
      this.busy = false
      uni.showToast({ title: normalized, icon: 'none' })
      this.keepRecentMessages()
      this.scrollToBottom(true)
    },
    normalizeAiError(messageText) {
      const text = String(messageText || '')
      if (text.includes('1302') || text.includes('速率限制')) {
        return '当前模型请求过于频繁，请稍后再试'
      }
      return text || '小东请求失败'
    },
    keepRecentMessages() {
      if (this.messages.length <= this.maxMessages) return
      const overflow = this.messages.length - this.maxMessages
      const removeCount = Math.max(10, overflow)
      this.messages = this.messages.slice(removeCount)
      this.hasMoreHistory = false
    },
    startAiTimeout() {
      this.clearAiTimeout()
      this.aiTimeoutTimer = setTimeout(() => {
        if (!this.busy || !this.activeAssistantId) return
        this.failAssistant('小东响应超时，请稍后重试')
      }, 45000)
    },
    clearAiTimeout() {
      if (!this.aiTimeoutTimer) return
      clearTimeout(this.aiTimeoutTimer)
      this.aiTimeoutTimer = null
    },
    async ensureGoodsList() {
      if (this.goodsLoaded && this.goodsList.length) return
      this.goodsList = await request({ url: '/api/goods' })
      this.goodsLoaded = true
    },
    buildDraftRow(item) {
      const row = {
        rowKey: `draft-${Date.now()}-${Math.random()}`,
        goodsId: Number(item?.goodsId || 0),
        goodsName: String(item?.goodsName || ''),
        unitType: item?.unitType === 'weight' ? 'weight' : 'qty',
        quantity: String(item?.quantity ?? ''),
        weight: item?.weight === null || item?.weight === undefined ? '' : String(item.weight),
        price: String(item?.price ?? ''),
        commission: item?.commission === null || item?.commission === undefined ? '' : String(item.commission),
        subtotal: 0,
        goodsSuggestions: []
      }
      this.updateDraftRowSubtotal(row)
      return row
    },
    buildSupplierEntryDraft(entry) {
      const unitType = entry?.unitType === 'weight' ? 'weight' : 'qty'
      return {
        supplierName: String(entry?.supplierName || ''),
        goodsName: String(entry?.goodsName || ''),
        unitType,
        unitIndex: unitType === 'weight' ? 1 : 0,
        quantity: String(entry?.quantity ?? ''),
        weight: entry?.weight === null || entry?.weight === undefined ? '' : String(entry.weight),
        totalAmount: String(entry?.totalAmount ?? ''),
        totalCommission: String(entry?.totalCommission ?? 0),
        costPrice: String(entry?.costPrice ?? ''),
        commission: String(entry?.commission ?? ''),
        salePrice: String(entry?.salePrice ?? ''),
        stockMode: entry?.stockMode === 'record_only' ? 'record_only' : 'auto_stocked',
        supplierSuggestions: [],
        goodsSuggestions: []
      }
    },
    updateDraftRowSubtotal(item) {
      const quantity = Number(item.quantity || 0)
      const weight = Number(item.weight || 0)
      const price = Number(item.price || 0)
      const commission = Number(item.commission || 0)
      item.subtotal = item.unitType === 'weight' && weight > 0
        ? Number((weight * price + quantity * commission).toFixed(2))
        : Number((quantity * price + quantity * commission).toFixed(2))
    },
    refreshDraftTotals(action) {
      if (!action || action.kind !== 'create_order') return
      action.items.forEach(item => this.updateDraftRowSubtotal(item))
      const total = action.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
      action.totalAmount = Number(total.toFixed(2))
      action.goodsAmount = action.totalAmount
      action.rowCount = action.items.length
    },
    refreshSupplierEntryDraft(action) {
      if (!action || action.kind !== 'create_supplier_entry') return
      const entry = action.supplierEntry
      const quantity = Number(entry.quantity || 0)
      const weight = Number(entry.weight || 0)
      const totalAmount = Number(entry.totalAmount || 0)
      const totalCommission = Number(entry.totalCommission || 0)
      const billingAmount = entry.unitType === 'weight' ? weight : quantity
      if (billingAmount > 0 && totalAmount >= totalCommission) {
        entry.costPrice = String(Number(((totalAmount - totalCommission) / billingAmount).toFixed(2)))
      }
      if (quantity > 0) {
        entry.commission = String(Number((totalCommission / quantity).toFixed(2)))
      }
      if (!entry.salePrice && entry.costPrice) entry.salePrice = entry.costPrice
    },
    findDraftAction(event) {
      const actionId = Number(event?.currentTarget?.dataset?.actionId || event?.target?.dataset?.actionId || 0)
      const message = this.messages.find(item => Number(item.id) === actionId)
      return message?.action || null
    },
    findDraftRow(action, event) {
      const rowIndex = Number(event?.currentTarget?.dataset?.rowIndex || event?.target?.dataset?.rowIndex || 0)
      return action?.items?.[rowIndex] || null
    },
    updateDraftItem(event) {
      const action = this.findDraftAction(event)
      const item = this.findDraftRow(action, event)
      if (!action || !item) return
      this.updateDraftRowSubtotal(item)
      this.refreshDraftTotals(action)
    },
    updateSupplierEntryDraft(event) {
      const action = this.findDraftAction(event)
      this.refreshSupplierEntryDraft(action)
    },
    onSupplierEntrySupplierInput(event) {
      const action = this.findDraftAction(event)
      if (!action || action.kind !== 'create_supplier_entry') return
      clearTimeout(this.supplierEntrySupplierTimer)
      this.supplierEntrySupplierTimer = setTimeout(() => this.searchSupplierEntrySuppliers(action), 220)
    },
    async searchSupplierEntrySuppliers(eventOrAction) {
      const action = eventOrAction?.kind ? eventOrAction : this.findDraftAction(eventOrAction)
      if (!action || action.kind !== 'create_supplier_entry') return
      const entry = action.supplierEntry
      const keyword = String(entry.supplierName || '').trim()
      if (!keyword) {
        entry.supplierSuggestions = []
        return
      }
      entry.supplierSuggestions = await request({ url: `/api/suppliers/search?q=${encodeURIComponent(keyword)}` })
    },
    selectSupplierEntrySupplier(event) {
      const action = this.findDraftAction(event)
      const index = Number(event?.currentTarget?.dataset?.supplierIndex || event?.target?.dataset?.supplierIndex || 0)
      const supplier = action?.supplierEntry?.supplierSuggestions?.[index]
      if (!action || !supplier) return
      action.supplierEntry.supplierName = supplier.name
      action.supplierEntry.supplierSuggestions = []
    },
    onSupplierEntryGoodsInput(event) {
      const action = this.findDraftAction(event)
      if (!action || action.kind !== 'create_supplier_entry') return
      clearTimeout(this.supplierEntryGoodsTimer)
      this.supplierEntryGoodsTimer = setTimeout(() => this.searchSupplierEntryGoods(action), 180)
      this.refreshSupplierEntryDraft(action)
    },
    async searchSupplierEntryGoods(eventOrAction) {
      const action = eventOrAction?.kind ? eventOrAction : this.findDraftAction(eventOrAction)
      if (!action || action.kind !== 'create_supplier_entry') return
      await this.ensureGoodsList()
      const entry = action.supplierEntry
      const keyword = String(entry.goodsName || '').trim()
      entry.goodsSuggestions = this.goodsList
        .filter(goods => !keyword || goods.name.includes(keyword))
        .slice(0, 8)
    },
    selectSupplierEntryGoods(event) {
      const action = this.findDraftAction(event)
      const index = Number(event?.currentTarget?.dataset?.goodsIndex || event?.target?.dataset?.goodsIndex || 0)
      const goods = action?.supplierEntry?.goodsSuggestions?.[index]
      if (!action || !goods) return
      const entry = action.supplierEntry
      entry.goodsName = goods.name
      entry.unitType = goods.unitType === 'weight' ? 'weight' : 'qty'
      entry.unitIndex = entry.unitType === 'weight' ? 1 : 0
      if (entry.unitType === 'qty') entry.weight = ''
      if (!entry.salePrice) entry.salePrice = String(goods.salePrice || goods.costPrice || '')
      entry.goodsSuggestions = []
      this.refreshSupplierEntryDraft(action)
    },
    changeSupplierEntryUnit(event) {
      const action = this.findDraftAction(event)
      if (!action || action.kind !== 'create_supplier_entry') return
      const index = Number(event?.detail?.value || 0)
      const option = this.entryUnitOptions[index] || this.entryUnitOptions[0]
      action.supplierEntry.unitType = option.value
      action.supplierEntry.unitIndex = index
      if (option.value === 'qty') action.supplierEntry.weight = ''
      this.refreshSupplierEntryDraft(action)
    },
    removeDraftItem(event) {
      const action = this.findDraftAction(event)
      const index = Number(event?.currentTarget?.dataset?.rowIndex || event?.target?.dataset?.rowIndex || 0)
      if (!action) return
      action.items.splice(index, 1)
      this.refreshDraftTotals(action)
    },
    onDraftCustomerInput(event) {
      const action = this.findDraftAction(event)
      if (!action) return
      action.customerId = null
      clearTimeout(this.draftCustomerTimer)
      this.draftCustomerTimer = setTimeout(() => this.searchDraftCustomers(action), 250)
    },
    async searchDraftCustomers(eventOrAction) {
      const action = eventOrAction?.kind ? eventOrAction : this.findDraftAction(eventOrAction)
      if (!action) return
      const keyword = String(action.customerName || '').trim()
      if (!keyword) {
        action.customerSuggestions = []
        return
      }
      action.customerSuggestions = await request({ url: `/api/customers/search?q=${encodeURIComponent(keyword)}` })
    },
    selectDraftCustomer(event) {
      const action = this.findDraftAction(event)
      const index = Number(event?.currentTarget?.dataset?.customerIndex || event?.target?.dataset?.customerIndex || 0)
      const customer = action?.customerSuggestions?.[index]
      if (!action || !customer) return
      action.customerName = customer.name
      action.customerId = customer.id
      action.customerSuggestions = []
    },
    onDraftGoodsInput(event) {
      const action = this.findDraftAction(event)
      const item = this.findDraftRow(action, event)
      if (!action || !item) return
      item.goodsId = 0
      clearTimeout(this.draftGoodsTimer)
      this.draftGoodsTimer = setTimeout(() => this.searchDraftGoods(action, item), 180)
      this.updateDraftRowSubtotal(item)
      this.refreshDraftTotals(action)
    },
    async searchDraftGoods(eventOrAction, maybeItem) {
      const action = eventOrAction?.kind ? eventOrAction : this.findDraftAction(eventOrAction)
      const item = maybeItem || this.findDraftRow(action, eventOrAction)
      if (!action || !item) return
      await this.ensureGoodsList()
      const keyword = String(item.goodsName || '').trim()
      item.goodsSuggestions = this.goodsList
        .filter(goods => !keyword || goods.name.includes(keyword))
        .slice(0, 8)
    },
    selectDraftGoods(event) {
      const action = this.findDraftAction(event)
      const item = this.findDraftRow(action, event)
      const goodsIndex = Number(event?.currentTarget?.dataset?.goodsIndex || event?.target?.dataset?.goodsIndex || 0)
      const goods = item?.goodsSuggestions?.[goodsIndex]
      if (!action || !item || !goods) return
      item.goodsId = goods.id
      item.goodsName = goods.name
      item.unitType = goods.unitType
      item.goodsSuggestions = []
      if (!item.price) item.price = String(goods.salePrice || goods.costPrice || 0)
      if (!item.commission) item.commission = String(goods.saleCommission || 0)
      if (goods.unitType !== 'weight') item.weight = ''
      this.updateDraftRowSubtotal(item)
      this.refreshDraftTotals(action)
    },
    buildDraftPayload(action) {
      return {
        customerId: action.customerId || null,
        customerName: String(action.customerName || '').trim(),
        items: action.items.map(item => ({
          goodsId: Number(item.goodsId || 0),
          quantity: Number(item.quantity || 0),
          weight: item.weight === '' ? 0 : Number(item.weight || 0),
          price: Number(item.price || 0),
          commission: Number(item.commission || 0)
        }))
      }
    },
    validateDraft(action) {
      if (!String(action.customerName || '').trim()) return '请填写客户'
      if (!action.items.length) return '请至少保留一个商品'
      const invalidGoods = action.items.find(item => !Number(item.goodsId || 0))
      if (invalidGoods) return `请选择库存商品：${invalidGoods.goodsName || '未填写品名'}`
      const invalidNumber = action.items.find(item => Number(item.quantity || 0) <= 0 || Number(item.price || 0) <= 0)
      if (invalidNumber) return '件数和价格必须大于0'
      const invalidWeight = action.items.find(item => item.unitType === 'weight' && Number(item.weight || 0) <= 0)
      if (invalidWeight) return `${invalidWeight.goodsName}请填写重量`
      return ''
    },
    buildSupplierEntryPayload(action) {
      const entry = action.supplierEntry || {}
      return {
        supplierEntry: {
          supplierName: String(entry.supplierName || '').trim(),
          goodsName: String(entry.goodsName || '').trim(),
          unitType: entry.unitType === 'weight' ? 'weight' : 'qty',
          quantity: Number(entry.quantity || 0),
          weight: entry.unitType === 'weight' ? Number(entry.weight || 0) : null,
          totalAmount: Number(entry.totalAmount || 0),
          totalCommission: Number(entry.totalCommission || 0),
          salePrice: Number(entry.salePrice || entry.costPrice || 0),
          stockMode: entry.stockMode || 'auto_stocked'
        }
      }
    },
    validateSupplierEntryDraft(action) {
      const entry = action?.supplierEntry || {}
      if (!String(entry.supplierName || '').trim()) return '请填写货主'
      if (!String(entry.goodsName || '').trim()) return '请填写品名'
      if (Number(entry.quantity || 0) <= 0) return '件数必须大于0'
      if (entry.unitType === 'weight' && Number(entry.weight || 0) <= 0) return '按斤入账必须填写重量'
      if (Number(entry.totalAmount || 0) <= 0) return '总金额必须大于0'
      if (Number(entry.totalCommission || 0) < 0) return '总佣金不能小于0'
      if (Number(entry.totalCommission || 0) > Number(entry.totalAmount || 0)) return '总佣金不能大于总金额'
      if (Number(entry.salePrice || entry.costPrice || 0) <= 0) return '售卖价必须大于0'
      return ''
    },
    findOrderInAction(action, orderId) {
      return action?.orders?.find(item => Number(item.id) === Number(orderId)) || null
    },
    editOrder(event) {
      const orderId = Number(event?.currentTarget?.dataset?.orderId || event?.target?.dataset?.orderId || 0)
      const order = { id: orderId }
      if (!order?.id) return
      uni.navigateTo({ url: `/pages/orders/detail?id=${order.id}&edit=1` })
    },
    deleteOrder(event) {
      const action = this.findDraftAction(event)
      const orderId = Number(event?.currentTarget?.dataset?.orderId || event?.target?.dataset?.orderId || 0)
      const order = this.findOrderInAction(action, orderId) || { id: orderId }
      if (!order?.id) return
      uni.showModal({
        title: '确认删单',
        content: '操作不可逆，确认删除这张订单吗？只有已付清订单允许删除。',
        confirmText: '删除',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          try {
            await request({ url: `/api/orders/${order.id}`, method: 'DELETE' })
            if (action?.orders) {
              action.orders = action.orders.filter(item => item.id !== order.id)
            }
            uni.showToast({ title: '已删除', icon: 'success' })
          } catch (err) {
            uni.showToast({ title: err?.message || '删除失败', icon: 'none' })
          }
        }
      })
    },
    async confirmDraft(event, printAfter = false) {
      const action = this.findDraftAction(event)
      const message = this.messages.find(item => item.action === action)
      if (!action || action.kind !== 'create_order' || !action.token) return
      if (action.submitting) return
      this.refreshDraftTotals(action)
      const invalidText = this.validateDraft(action)
      if (invalidText) {
        uni.showToast({ title: invalidText, icon: 'none' })
        return
      }

      uni.showModal({
        title: printAfter ? '确认出单并打印' : '确认出单',
        content: `操作不可逆，确认${printAfter ? '出单并打印' : '出单'}吗？合计 ¥${money(action.totalAmount)}`,
        confirmText: printAfter ? '出单打印' : '出单',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          action.submitting = true
          try {
            const result = await confirmAiOperation(action.token, this.buildDraftPayload(action))
            const orderNo = result?.order?.orderNo || ''
            const orderId = result?.order?.id || result?.result?.id
            let printSent = false
            let printError = ''
            if (printAfter) {
              if (orderId) {
                try {
                  await request({ url: '/api/prints/order', method: 'POST', data: { orderId } })
                  printSent = true
                } catch (err) {
                  printError = err?.message || '打印失败'
                }
              } else {
                printError = '出单成功，但没有返回订单ID，未发送打印'
              }
            }
            message.content = `${message.content}\n已确认执行，订单号：${orderNo}${printAfter ? (printSent ? '，已发送打印' : `，${printError}`) : ''}`
            message.action = null
            this.goodsLoaded = false
            uni.showToast({
              title: printAfter && !printSent ? (printError || '出单成功，打印失败') : (printAfter ? '出单并打印成功' : '出单成功'),
              icon: printAfter && !printSent ? 'none' : 'success'
            })
          } catch (err) {
            uni.showToast({ title: err?.message || '确认失败', icon: 'none' })
          } finally {
            action.submitting = false
          }
        }
      })
    },
    confirmDraftAndPrint(event) {
      return this.confirmDraft(event, true)
    },
    async confirmSupplierEntryDraft(event) {
      const action = this.findDraftAction(event)
      const message = this.messages.find(item => item.action === action)
      if (!action || action.kind !== 'create_supplier_entry' || !action.token) return
      if (action.submitting) return
      this.refreshSupplierEntryDraft(action)
      const invalidText = this.validateSupplierEntryDraft(action)
      if (invalidText) {
        uni.showToast({ title: invalidText, icon: 'none' })
        return
      }

      uni.showModal({
        title: '确认入账',
        content: `操作不可逆，确认入账吗？合计 ¥${money(action.supplierEntry.totalAmount)}`,
        confirmText: '入账',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          action.submitting = true
          try {
            const result = await confirmAiOperation(action.token, this.buildSupplierEntryPayload(action))
            const entryNo = result?.result?.entryNo || result?.order?.entryNo || ''
            message.content = `${message.content}\n已确认入账，单号：${entryNo}`
            message.action = null
            this.goodsLoaded = false
            uni.showToast({ title: '入账成功', icon: 'success' })
          } catch (err) {
            uni.showToast({ title: err?.message || '入账失败', icon: 'none' })
          } finally {
            action.submitting = false
          }
        }
      })
    },
    async confirmGoodsMutation(event) {
      const action = this.findDraftAction(event)
      const message = this.messages.find(item => item.action === action)
      if (!action || action.kind !== 'goods_mutation' || !action.token) return
      if (action.submitting) return

      action.submitting = true
      try {
        const result = await confirmAiOperation(action.token)
        const messageText = result?.result?.message || result?.order?.message || '库存操作已执行'
        if (message) {
          message.content = `${message.content}\n${messageText}`
          message.action = null
        }
        this.goodsLoaded = false
        uni.showToast({ title: '操作成功', icon: 'success' })
      } catch (err) {
        uni.showToast({ title: err?.message || '操作失败', icon: 'none' })
      } finally {
        action.submitting = false
      }
    },
    scrollToBottom(force = false) {
      this.$nextTick(() => {
        if (this.scrollReleaseTimer) {
          clearTimeout(this.scrollReleaseTimer)
          this.scrollReleaseTimer = null
        }
        this.scrollIntoView = ''
        setTimeout(() => {
          this.scrollIntoView = 'message-bottom'
          this.scrollReleaseTimer = setTimeout(() => {
            this.scrollIntoView = ''
            this.scrollReleaseTimer = null
          }, 350)
        }, force ? 0 : 20)
      })
    }
  }
}
</script>

<style scoped>
.ai-page {
  height: 100vh;
  min-height: 100vh;
  width: 100%;
  padding: 0 20rpx;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f6fbf3 0%, #f4f7ef 100%);
  overflow: hidden;
}

/* #ifdef H5 */
:deep(uni-page-body),
:deep(uni-page-wrapper) {
  height: 100%;
  overflow: hidden;
}

::v-deep uni-page-body,
::v-deep uni-page-wrapper {
  height: 100%;
  overflow: hidden;
}
/* #endif */

.top-bar {
  width: 100%;
  z-index: 80;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 20rpx 16rpx;
  box-sizing: border-box;
  background: rgba(246, 251, 243, 0.96);
  backdrop-filter: blur(8px);
}

/* #ifdef H5 || APP-PLUS */
.top-bar {
  padding-top: calc(22rpx + var(--window-top, 0px));
}
/* #endif */

.title-wrap {
  display: flex;
  flex-direction: column;
}

.brand {
  color: #16945f;
  font-size: 24rpx;
  font-weight: 900;
}

.title {
  margin-top: 6rpx;
  color: #17362f;
  font-size: 42rpx;
  font-weight: 900;
}

.status-pill {
  min-width: 116rpx;
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: #fff4c8;
  color: #8a6413;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.status-pill.online {
  background: #e8f6ed;
  color: #166b4e;
}

.message-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
  z-index: 10;
  box-sizing: border-box;
  padding-top: 12rpx;
}

.history-tip {
  padding: 10rpx 0 18rpx;
  color: #8a958f;
  font-size: 22rpx;
  text-align: center;
}

.message-row {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 14rpx;
  overflow: hidden;
}

.message-row.user {
  justify-content: flex-end;
}

.message-row.assistant {
  justify-content: flex-start;
}

.bubble {
  max-width: 82%;
  min-width: 0;
  padding: 14rpx 16rpx;
  border-radius: 20rpx;
  color: #17362f;
  font-size: 24rpx;
  line-height: 1.55;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  box-sizing: border-box;
}

.user .bubble {
  border: 1rpx solid #16945f;
  background: linear-gradient(180deg, #16945f 0%, #157956 100%);
  color: #ffffff;
}

.assistant .bubble {
  border: 1rpx solid #dde8d7;
  background: #ffffff;
  box-shadow: 0 8rpx 18rpx rgba(25, 55, 44, 0.06);
}

.typing {
  margin-top: 4rpx;
  color: #718078;
  font-size: 20rpx;
  font-weight: 800;
}

.message-bottom {
  height: 10rpx;
}

.action-panel {
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #edf2ea;
}

.action-head {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  margin-bottom: 10rpx;
}

.action-title {
  color: #17362f;
  font-size: 26rpx;
  font-weight: 900;
}

.action-summary {
  color: #5f6d64;
  font-size: 22rpx;
  line-height: 1.5;
}

.table-wrap {
  border: 1rpx solid #e2ece0;
  border-radius: 14rpx;
  overflow: hidden;
}

.table-row {
  display: grid;
  gap: 0;
  border-bottom: 1rpx solid #edf2ea;
}

.table-row.cols-1 {
  grid-template-columns: minmax(0, 1fr);
}

.table-row.cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.table-row.cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.table-row.cols-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.table-row.cols-5 {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.table-row.cols-6 {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.table-row.cols-7 {
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.table-row:last-child {
  border-bottom: 0;
}

.table-head {
  background: #f4fbf6;
}

.table-cell {
  min-width: 0;
  padding: 10rpx 8rpx;
  color: #244238;
  font-size: 20rpx;
  line-height: 1.4;
  text-align: center;
  word-break: break-word;
}

.table-head .table-cell {
  font-weight: 900;
}

.draft-editor {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.draft-customer {
  display: grid;
  grid-template-columns: 70rpx minmax(0, 1fr);
  gap: 10rpx;
  align-items: center;
}

.draft-label {
  color: #17362f;
  font-size: 24rpx;
  font-weight: 900;
}

.draft-input {
  min-width: 0;
  height: 58rpx;
  min-height: 58rpx;
  padding: 0 10rpx;
  border: 1rpx solid #dce8d9;
  border-radius: 10rpx;
  box-sizing: border-box;
  background: #fbfdf9;
  color: #17362f;
  font-size: 22rpx;
}

.draft-suggest-list {
  max-height: 220rpx;
  border: 1rpx solid #dce8d9;
  border-radius: 12rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 26rpx rgba(24, 37, 46, 0.12);
  overflow: hidden;
}

.customer-suggest-list {
  margin-left: 80rpx;
}

.draft-suggest-item {
  min-height: 56rpx;
  padding: 14rpx 16rpx;
  border-bottom: 1rpx solid #eef2ee;
  color: #17362f;
  font-size: 24rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.entry-draft-editor {
  padding: 12rpx;
  border: 1rpx solid #e2ece0;
  border-radius: 14rpx;
  background: #fbfdf9;
}

.entry-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.entry-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6rpx;
}

.entry-field.suggest-field {
  position: relative;
  z-index: 20;
}

.entry-field.suggest-field:nth-child(2) {
  z-index: 19;
}

.entry-field text {
  color: #5f6d64;
  font-size: 21rpx;
  font-weight: 900;
}

.entry-suggest-list {
  position: absolute;
  left: 0;
  right: 0;
  top: 86rpx;
  z-index: 90;
  max-height: 154rpx;
}

.picker-value {
  height: 58rpx;
  padding: 0 10rpx;
  border: 1rpx solid #dce8d9;
  border-radius: 10rpx;
  background: #ffffff;
  color: #17362f;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 58rpx;
}

.editable-scroll {
  width: 100%;
  overflow: visible;
}

.editable-table {
  width: 860rpx;
  overflow: visible;
  border: 1rpx solid #e2ece0;
  border-radius: 14rpx;
  background: #ffffff;
}

.editable-head,
.editable-row {
  display: grid;
  grid-template-columns: 210rpx 110rpx 110rpx 110rpx 110rpx 210rpx;
  width: 860rpx;
  border-bottom: 1rpx solid #edf2ea;
}

.editable-row:last-child {
  border-bottom: 0;
}

.editable-head {
  background: #f4fbf6;
}

.editable-head text {
  padding: 10rpx 8rpx;
  color: #244238;
  font-size: 20rpx;
  font-weight: 900;
  text-align: center;
}

.editable-row {
  align-items: start;
  min-height: 84rpx;
}

.editable-row.expanded {
  min-height: 220rpx;
}

.editable-row > .draft-input,
.goods-field,
.subtotal-cell {
  min-height: 76rpx;
  padding: 8rpx 6rpx;
  box-sizing: border-box;
}

.goods-field {
  position: relative;
}

.editable-row.expanded .goods-field {
  min-height: 206rpx;
}

.goods-input {
  width: 100%;
}

.goods-suggest-list {
  position: absolute;
  left: 6rpx;
  right: 6rpx;
  top: 70rpx;
  z-index: 80;
  max-height: 132rpx;
}

.number-input {
  width: calc(100% - 12rpx);
  height: 58rpx;
  min-height: 58rpx;
  margin: 8rpx 6rpx;
  text-align: center;
}

.subtotal-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  color: #166b4e;
  font-size: 20rpx;
  font-weight: 900;
  white-space: nowrap;
}

.row-delete {
  width: 44rpx;
  min-width: 44rpx;
  height: 42rpx;
  min-height: 42rpx;
  padding: 0;
  border-radius: 8rpx;
  background: #fff0ee;
  color: #d64b3f;
  font-size: 20rpx;
  line-height: 42rpx;
}

.action-footer {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 12rpx;
}

.action-meta {
  display: flex;
  justify-content: space-between;
  color: #166b4e;
  font-size: 22rpx;
  font-weight: 900;
}

.action-button {
  width: 100%;
  height: 68rpx;
  line-height: 68rpx;
  border-radius: 18rpx;
  background: #16945f;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 900;
}

.action-button-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
}

.action-button.print {
  background: #fff4c8;
  color: #8a6413;
}

.action-button.danger {
  background: #d64b3f;
}

.mutation-footer {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 12rpx;
}

.mutation-warning {
  color: #8a4b16;
  font-size: 22rpx;
  font-weight: 800;
}

.order-action-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 12rpx;
}

.order-action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 86rpx 86rpx;
  gap: 8rpx;
  align-items: center;
  min-height: 56rpx;
}

.order-action-text {
  overflow: hidden;
  color: #244238;
  font-size: 22rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-action {
  width: 86rpx;
  min-width: 86rpx;
  height: 52rpx;
  min-height: 52rpx;
  padding: 0;
  border-radius: 10rpx;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 52rpx;
}

.mini-action.edit {
  background: #e8f6ed;
  color: #166b4e;
}

.mini-action.delete {
  background: #fff0ee;
  color: #d64b3f;
}

.composer-shell {
  width: 100%;
  z-index: 90;
  flex-shrink: 0;
  padding: 0 0 24rpx;
  box-sizing: border-box;
  transition: transform 180ms ease;
  will-change: transform;
}

/* #ifdef H5 || APP-PLUS */
.composer-shell {
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}
/* #endif */

.ai-page.keyboard-open .composer-shell {
  padding-bottom: 8rpx;
}

.composer-shell.lifted {
  padding-bottom: 8rpx;
}

.composer-card {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 0;
  border-radius: 24rpx;
  border: 0;
  box-shadow: none;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-top: 10rpx;
}

.voice-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-top: 10rpx;
}

.text-input {
  flex: 1;
  min-width: 0;
  min-height: 68rpx;
  max-height: 180rpx;
  padding: 14rpx;
  border-radius: 20rpx;
  border: 1rpx solid #e0eadc;
  box-sizing: border-box;
  background: #f7faf5;
  color: #17362f;
  font-size: 26rpx;
  line-height: 38rpx;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.send-button {
  width: 68rpx;
  height: 68rpx;
  min-width: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

::v-deep .text-input textarea,
::v-deep .text-input .uni-textarea-textarea {
  min-height: 40rpx;
  line-height: 38rpx;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
}

.send-button.disabled {
  opacity: 0.45;
}

.voice-toggle-button {
  width: 68rpx;
  height: 68rpx;
  min-width: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.composer-icon {
  width: 68rpx;
  height: 68rpx;
  display: block;
}

.voice-button {
  flex: 1;
  min-height: 82rpx;
  border-radius: 22rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  background: linear-gradient(180deg, #f8fbf4 0%, #edf8ef 100%);
  box-shadow: inset 0 0 0 1rpx rgba(22, 148, 95, 0.12);
}

.keyboard-button {
  width: 68rpx;
  height: 68rpx;
  min-width: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.voice-button.recording {
  background: linear-gradient(180deg, #fff1ef 0%, #ffdede 100%);
  box-shadow: inset 0 0 0 1rpx rgba(214, 75, 63, 0.16);
}

.voice-button.cancelled {
  background: linear-gradient(180deg, #ffe7e3 0%, #ffd4cf 100%);
}

.voice-button.recognizing {
  opacity: 0.92;
}

.voice-main {
  color: #17362f;
  font-size: 24rpx;
  font-weight: 900;
}

.voice-button.recording .voice-main {
  color: #d64b3f;
}

.voice-sub {
  color: #718078;
  font-size: 20rpx;
  font-weight: 800;
}

.voice-record-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 999;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0 28rpx calc(34rpx + env(safe-area-inset-bottom));
  background: rgba(0, 0, 0, 0.66);
}

.voice-record-bubble {
  position: absolute;
  left: 50%;
  bottom: 520rpx;
  width: 560rpx;
  height: 142rpx;
  margin-left: -280rpx;
  border-radius: 34rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #8df06b;
}

.voice-record-bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -28rpx;
  width: 56rpx;
  height: 56rpx;
  margin-left: -28rpx;
  border-radius: 10rpx;
  background: inherit;
  transform: rotate(45deg);
}

.voice-record-bubble.cancel {
  left: 190rpx;
  width: 150rpx;
  height: 150rpx;
  margin-left: 0;
  border-radius: 30rpx;
  background: #ff5057;
}

.wave-bars {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  height: 42rpx;
}

.wave-bar {
  width: 7rpx;
  height: 18rpx;
  border-radius: 999rpx;
  background: rgba(20, 68, 55, 0.8);
  animation: voice-wave 620ms ease-in-out infinite;
}

.wave-bar:nth-child(2),
.wave-bar:nth-child(8) {
  animation-delay: 80ms;
}

.wave-bar:nth-child(3),
.wave-bar:nth-child(7) {
  animation-delay: 160ms;
}

.wave-bar:nth-child(4),
.wave-bar:nth-child(6) {
  animation-delay: 240ms;
}

.wave-bar:nth-child(5) {
  animation-delay: 320ms;
}

.voice-record-panel {
  position: relative;
  min-height: 360rpx;
  padding-top: 36rpx;
}

.voice-record-hint {
  height: 72rpx;
  color: rgba(255, 255, 255, 0.78);
  font-size: 32rpx;
  font-weight: 900;
  text-align: center;
}

.voice-record-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 34rpx;
  align-items: center;
}

.voice-record-action {
  height: 148rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.82);
  font-size: 34rpx;
  font-weight: 900;
  transform: rotate(-8deg);
}

.voice-record-action.active {
  background: rgba(255, 255, 255, 0.9);
  color: #1f2724;
}

.text-action {
  transform: rotate(8deg);
}

.voice-record-bottom {
  margin-top: 46rpx;
  color: rgba(255, 255, 255, 0.84);
  font-size: 32rpx;
  font-weight: 900;
  text-align: center;
}

@keyframes voice-wave {
  0%,
  100% {
    height: 12rpx;
  }
  50% {
    height: 38rpx;
  }
}

</style>
