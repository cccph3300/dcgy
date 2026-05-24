import { API_BASE } from '../config/api'
import { getToken, request } from './request'

export function buildAiSocketUrl() {
  const token = encodeURIComponent(getToken() || '')
  const base = API_BASE.replace(/\/$/, '')
  const socketBase = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
  return `${socketBase}/api/ai/chat/ws?token=${token}`
}

export function connectAiSocket({ onReady, onStart, onDelta, onDone, onError, onClose }) {
  const task = uni.connectSocket({
    url: buildAiSocketUrl(),
    success() {},
    fail(err) {
      onError?.(err?.errMsg || 'AI 连接失败')
    }
  })

  task.onOpen(() => {
    onReady?.()
  })

  task.onMessage((event) => {
    let data
    try {
      data = JSON.parse(event.data)
    } catch {
      return
    }

    if (data.type === 'ready') onReady?.()
    if (data.type === 'start') onStart?.()
    if (data.type === 'delta') onDelta?.(data.content || '')
    if (data.type === 'result') onDelta?.({ content: data.content || '', action: data.action || null, final: true })
    if (data.type === 'done') onDone?.()
    if (data.type === 'error') onError?.(data.message || 'AI 对话失败')
  })

  task.onError((err) => {
    onError?.(err?.errMsg || 'AI 连接异常')
  })

  task.onClose(() => {
    onClose?.()
  })

  return task
}

export function sendAiMessage(socketTask, messages, content, context = {}) {
  return new Promise((resolve, reject) => {
    socketTask.send({
      data: JSON.stringify({
        type: 'message',
        content,
        messages,
        context
      }),
      success: resolve,
      fail: reject
    })
  })
}

export function speechToText(payload) {
  return request({
    url: '/api/ai/speech-to-text',
    method: 'POST',
    data: payload,
    timeout: 30000
  })
}

export function confirmAiOperation(token, payload = {}) {
  return request({
    url: '/api/ai/confirm',
    method: 'POST',
    data: { token, ...payload }
  })
}

export function fetchAiMessages({ beforeId = '', limit = 10 } = {}) {
  const params = [`limit=${encodeURIComponent(limit)}`]
  if (beforeId) params.push(`beforeId=${encodeURIComponent(beforeId)}`)

  return request({
    url: `/api/ai/messages?${params.join('&')}`,
    method: 'GET'
  })
}

export function readFileAsBase64(filePath) {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    wx.getFileSystemManager().readFile({
      filePath,
      success({ data }) {
        resolve(wx.arrayBufferToBase64(data))
      },
      fail: reject
    })
    // #endif

    // #ifdef APP-PLUS
    const reader = new plus.io.FileReader()
    reader.onloadend = (event) => {
      const result = String(event.target.result || '')
      resolve(result.replace(/^data:[^;]+;base64,/, ''))
    }
    reader.onerror = reject
    reader.readAsDataURL(filePath)
    // #endif

    // #ifdef H5
    fetch(filePath)
      .then(response => response.blob())
      .then(blob => readBlobAsBase64(blob))
      .then(resolve)
      .catch(reject)
    // #endif
  })
}

export function readBlobAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/, ''))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function normalizeVoiceFormat(value) {
  const raw = String(value || '').toLowerCase()
  if (raw.includes('ogg') || raw.includes('opus')) return 'ogg-opus'
  if (raw.includes('wav')) return 'wav'
  if (raw.includes('m4a') || raw.includes('mp4')) return 'm4a'
  if (raw.includes('aac')) return 'aac'
  if (raw.includes('amr')) return 'amr'
  if (raw.includes('silk')) return 'silk'
  if (raw.includes('speex')) return 'speex'
  if (raw.includes('pcm')) return 'pcm'
  if (raw.includes('mp3') || raw.includes('mpeg')) return 'mp3'
  return ''
}

export function inferVoiceFormat(filePath, mimeType = '') {
  const byMimeType = normalizeVoiceFormat(mimeType)
  if (byMimeType) return byMimeType

  const match = String(filePath || '').toLowerCase().match(/\.([a-z0-9-]+)(?:\?|$)/)
  return normalizeVoiceFormat(match?.[1]) || 'mp3'
}
