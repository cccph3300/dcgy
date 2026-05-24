import { defineWebSocketHandler } from 'h3'
import { getStaffByToken } from '../../../utils/auth'
import { answerAiChat, validateAiChatInput, type AiChatInput } from '../../../utils/ai-chat-service'

function sendJson(peer: any, payload: Record<string, unknown>) {
  peer.send(JSON.stringify(payload))
}

function getQueryToken(peer: any) {
  const url = new URL(peer.request.url, 'http://localhost')
  return url.searchParams.get('token') || ''
}

export default defineWebSocketHandler({
  async open(peer) {
    const staff = await getStaffByToken(getQueryToken(peer))
    if (!staff) {
      sendJson(peer, { type: 'error', message: '请先登录' })
      peer.close(1008, 'unauthorized')
      return
    }

    peer.context.staff = staff
    sendJson(peer, { type: 'ready' })
  },
  async message(peer, message) {
    if (!peer.context.staff) {
      sendJson(peer, { type: 'error', message: '请先登录' })
      return
    }

    let input: AiChatInput & { type?: string }
    try {
      input = JSON.parse(message.text())
    } catch {
      sendJson(peer, { type: 'error', message: '消息格式错误' })
      return
    }

    if (input.type !== 'message') {
      sendJson(peer, { type: 'error', message: '消息格式错误' })
      return
    }

    try {
      validateAiChatInput(input)
      sendJson(peer, { type: 'start' })
      const result = await answerAiChat(input, peer.context.staff.id, {
        onDelta: content => sendJson(peer, { type: 'delta', content })
      })
      sendJson(peer, {
        type: 'result',
        content: result.content,
        action: result.action
      })
      sendJson(peer, { type: 'done' })
    } catch (error: any) {
      sendJson(peer, { type: 'error', message: String(error?.message || 'AI 对话失败') })
    }
  }
})
