<template>
  <page-meta page-style="overflow: hidden;" />
  <view class="page ai-page">
    <view class="top-bar">
      <view class="title-wrap">
        <text class="brand">东成果业</text>
        <text class="title">AI智能对话</text>
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
          <view v-if="message.loading" class="typing">AI 正在生成...</view>

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

              <view class="editable-table">
                <view class="editable-head">
                  <text>品名</text>
                  <text>件数</text>
                  <text>重量</text>
                  <text>价格</text>
                  <text>佣金</text>
                  <text>小计</text>
                </view>
                <view v-for="(item, rowIndex) in message.action.items" :key="item.rowKey" class="editable-row">
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
            </view>

            <view v-else class="table-wrap">
              <view class="table-row table-head">
                <text v-for="col in message.action.table.columns" :key="col" class="table-cell">{{ col }}</text>
              </view>
              <view v-for="(row, rowIndex) in message.action.table.rows" :key="rowIndex" class="table-row">
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

            <view v-if="message.action.kind === 'create_order'" class="action-footer">
              <view class="action-meta">
                <text>合计 ￥{{ money(message.action.totalAmount) }}</text>
                <text>共 {{ message.action.rowCount }} 项</text>
              </view>
              <button class="action-button primary" :disabled="message.action.submitting" :data-action-id="message.id" @click="confirmDraft">
                {{ message.action.submitting ? '出单中' : '确认出单' }}
              </button>
            </view>
          </view>
        </view>
      </view>

      <view id="message-bottom" class="message-bottom"></view>
    </scroll-view>

    <view class="composer-shell">
      <view class="composer-card">
        <view v-if="composerMode === 'text'" class="input-row">
          <textarea
            class="text-input"
            v-model="inputText"
            placeholder="先说内容，再点发送"
            :maxlength="100"
            auto-height
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
  speechToText
} from '../../utils/ai'
import { request, requireLogin } from '../../utils/request'
import { money } from '../../utils/format'

export default {
  data() {
    return {
      maxMessages: 50,
      socketTask: null,
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
      touchStartY: 0,
      touchCancelThreshold: 72,
      touchActive: false,
      cancelledRecording: false,
      mouseActive: false,
      goodsList: [],
      goodsLoaded: false,
      draftCustomerTimer: null,
      draftGoodsTimer: null,
      recordStartTimer: null,
      h5MediaRecorder: null,
      h5RecordChunks: [],
      h5RecordStream: null
    }
  },
  computed: {
    statusText() {
      if (this.recording) return '录音中'
      if (this.recognizing) return '识别中'
      if (this.busy) return 'AI 思考中'
      return this.connected ? '已连接' : '连接中'
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
    canSendText() {
      return !!String(this.inputText || '').trim()
    },
    canLoadMoreHistory() {
      return this.hasMoreHistory && this.messages.length < this.maxMessages
    }
  },
  onShow() {
    if (!requireLogin()) return
    this.refreshVoiceSupport()
    this.openSocket()
    this.initRecorder()
    if (!this.historyLoaded) this.loadLatestMessages()
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
      this.socketTask = connectAiSocket({
        onReady: () => {
          this.connected = true
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
        onError: (message) => {
          this.failAssistant(message)
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
        uni.showToast({ title: err?.message || '加载 AI 记录失败', icon: 'none' })
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
        uni.showToast({ title: err?.message || '加载 AI 记录失败', icon: 'none' })
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
        if (cancelled) return
        await this.handleNativeRecordStop(res?.tempFilePath)
      })
      this.recorder.onError((err) => {
        this.recording = false
        this.recognizing = false
        this.cancelledRecording = false
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

        // #ifdef APP-PLUS || H5
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
    getEventY(event) {
      return event?.touches?.[0]?.clientY ?? event?.clientY ?? 0
    },
    onVoiceTouchStart(event) {
      this.startVoicePress(this.getEventY(event))
    },
    onVoiceTouchMove(event) {
      if (!this.touchActive || !this.recording) return
      const currentY = this.getEventY(event)
      const deltaY = this.touchStartY - currentY
      this.cancelledRecording = deltaY > this.touchCancelThreshold
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
      this.startVoicePress(this.getEventY(event))
      this.bindMouseListeners()
    },
    onWindowMouseMove(event) {
      if (!this.mouseActive || !this.recording) return
      const currentY = this.getEventY(event)
      const deltaY = this.touchStartY - currentY
      this.cancelledRecording = deltaY > this.touchCancelThreshold
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
    startVoicePress(clientY) {
      if (!this.voiceSupported || this.busy || this.recognizing || this.recording) return
      this.touchActive = true
      this.cancelledRecording = false
      this.touchStartY = clientY || 0
      this.clearRecordStartTimer()
      this.recordStartTimer = setTimeout(() => {
        if (!this.touchActive) return
        this.beginVoiceRecord()
      }, 220)
    },
    endVoicePress() {
      this.clearRecordStartTimer()
      if (!this.touchActive) return
      this.touchActive = false
      if (!this.recording) return
      if (this.cancelledRecording) {
        this.cancelVoicePress()
      } else {
        this.stopVoiceRecord()
      }
    },
    cancelVoicePress() {
      this.clearRecordStartTimer()
      this.touchActive = false
      if (this.recording) {
        this.cancelledRecording = true
        this.stopVoiceRecord()
      } else {
        this.cancelledRecording = false
      }
      this.unbindMouseListeners()
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
    startNativeRecord() {
      this.ensureRecordPermission()
        .then(() => {
          this.initRecorder()
          if (!this.recorder || typeof this.recorder.start !== 'function') {
            uni.showToast({ title: '当前设备不支持录音', icon: 'none' })
            return
          }
          this.recording = true
          this.cancelledRecording = false
          this.recorder.start({
            duration: 60000,
            sampleRate: 16000,
            numberOfChannels: 1,
            encodeBitRate: 48000,
            format: 'aac'
          })
        })
        .catch((err) => {
          this.recording = false
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
          if (cancelled) return
          await this.handleH5RecordStop(blob)
        }
        recorder.onerror = () => {
          this.recording = false
          this.cancelledRecording = false
          this.resetH5Record()
          uni.showToast({ title: '录音失败', icon: 'none' })
        }

        recorder.start()
      } catch (err) {
        this.recording = false
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
      this.unbindMouseListeners()
      if (this.recording) {
        this.stopVoiceRecord()
      } else {
        this.resetH5Record()
      }
      this.recording = false
      this.recognizing = false
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
      uni.showLoading({ title: '识别中...' })
      try {
        const audioBase64 = await readFileAsBase64(filePath)
        const text = await this.requestSpeechText(audioBase64, inferVoiceFormat(filePath))
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
      if (!this.socketTask) {
        uni.showToast({ title: 'AI 连接失败', icon: 'none' })
        return
      }

      this.inputText = ''
      this.addMessage('user', content)
      const assistant = this.addMessage('assistant', '', true)
      this.activeAssistantId = assistant.id
      this.busy = true
      this.keepRecentMessages()
      this.startAiTimeout()
      this.scrollToBottom(true)

      try {
        await sendAiMessage(this.socketTask, this.buildHistory(), content, this.buildAiContext())
      } catch (err) {
        this.failAssistant(err?.message || '发送失败')
      }
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
      if (content) message.content += content
      if (payload?.action) message.action = this.normalizeAction(payload.action)
      if (payload?.final) message.loading = false
      this.scrollToBottom(true)
    },
    normalizeAction(action) {
      if (!action) return null
      if (action.kind === 'create_order') {
        const draft = action.draft || {}
        const items = Array.isArray(draft.items) ? draft.items.map(item => this.buildDraftRow(item)) : []
        const normalized = {
          ...action,
          submitting: false,
          table: action.table || { title: '', columns: [], rows: [] },
          customerName: draft.customerName || '客户',
          customerId: null,
          customerSuggestions: [],
          items
        }
        this.refreshDraftTotals(normalized)
        return normalized
      }
      return {
        ...action,
        submitting: false,
        table: action.table || { title: '', columns: [], rows: [] }
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
      return text || 'AI 请求失败'
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
        this.failAssistant('AI 响应超时，请稍后重试')
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
    updateDraftRowSubtotal(item) {
      const quantity = Number(item.quantity || 0)
      const weight = Number(item.weight || 0)
      const price = Number(item.price || 0)
      const commission = Number(item.commission || 0)
      item.subtotal = item.unitType === 'weight' && weight > 0
        ? Number((weight * price + quantity * commission).toFixed(2))
        : Number((quantity * price + commission).toFixed(2))
    },
    refreshDraftTotals(action) {
      if (!action || action.kind !== 'create_order') return
      action.items.forEach(item => this.updateDraftRowSubtotal(item))
      const total = action.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
      action.totalAmount = Number(total.toFixed(2))
      action.goodsAmount = action.totalAmount
      action.rowCount = action.items.length
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
      if (!item.commission) item.commission = String(goods.defaultCommission || 0)
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
    async confirmDraft(event) {
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
        title: '确认出单',
        content: `操作不可逆，确认出单吗？合计 ¥${money(action.totalAmount)}`,
        confirmText: '出单',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          action.submitting = true
          try {
            const result = await confirmAiOperation(action.token, this.buildDraftPayload(action))
            const orderNo = result?.order?.orderNo || ''
            message.content = `${message.content}\n已确认执行，订单号：${orderNo}`
            message.action = null
            this.goodsLoaded = false
            uni.showToast({ title: '出单成功', icon: 'success' })
          } catch (err) {
            uni.showToast({ title: err?.message || '确认失败', icon: 'none' })
          } finally {
            action.submitting = false
          }
        }
      })
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
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0;
  border-bottom: 1rpx solid #edf2ea;
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

.editable-table {
  overflow-x: auto;
  border: 1rpx solid #e2ece0;
  border-radius: 14rpx;
  background: #ffffff;
}

.editable-head,
.editable-row {
  display: grid;
  grid-template-columns: 172rpx 92rpx 92rpx 92rpx 92rpx 126rpx;
  min-width: 666rpx;
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

.goods-input {
  width: 100%;
}

.goods-suggest-list {
  position: absolute;
  left: 6rpx;
  right: 6rpx;
  top: 70rpx;
  z-index: 20;
}

.number-input {
  width: calc(100% - 12rpx);
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
}

/* #ifdef H5 || APP-PLUS */
.composer-shell {
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}
/* #endif */

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
</style>
