import { defineWebSocketHandler } from 'h3'
import { getStaffByToken } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { saveAiChatMessage, trimAiChatMessages } from '../../../utils/ai-chat-history'
import { answerAiDataQuestion, type AiStructuredIntent } from '../../../utils/ai-data-actions'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ClientMessage = {
  type?: string
  content?: string
  messages?: ChatMessage[]
  context?: {
    pendingDraft?: unknown
  }
}

function sendJson(peer: any, payload: Record<string, unknown>) {
  peer.send(JSON.stringify(payload))
}

function getQueryToken(peer: any) {
  const url = new URL(peer.request.url, 'http://localhost')
  return url.searchParams.get('token') || ''
}

function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, '') || ''
}

function getLlmConfig() {
  const apiKey = cleanEnv(process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.ZHIPU_API_KEY)
  if (!apiKey) {
    throw new Error('缺少配置：LLM_API_KEY')
  }

  return {
    apiKey,
    model: cleanEnv(process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || process.env.ZHIPU_MODEL) || 'deepseek-v4-flash',
    endpoint: cleanEnv(process.env.LLM_API_ENDPOINT || process.env.DEEPSEEK_API_ENDPOINT || process.env.ZHIPU_API_ENDPOINT) || 'https://api.deepseek.com/chat/completions'
  }
}

function buildMessages(input: ClientMessage): ChatMessage[] {
  const history = Array.isArray(input.messages)
    ? input.messages.filter(item => item && item.role && item.content).slice(-12)
    : []
  const content = String(input.content || '').trim()
  const userMessages = history.length ? history : [{ role: 'user' as const, content }]

  return [
    {
      role: 'system',
      content: [
        '你是东成果业的 AI 智能对话助手，熟悉水果批发订单、客户欠款、库存和出单流程。',
        '所有涉及数据库的请求，必须先在心里完成意图拆解：1. 用户想操作什么实体；2. 有哪些筛选条件；3. 缺失哪些必要信息；4. 是否可以执行。',
        '不要直接生成 SQL，不要展示 SQL。后端会优先识别并处理数据库增删改查意图；你只负责未被规则命中的自然对话和补充追问。',
        '实体识别规则：哪个客户/某客户 -> 客户 name/customer_id，必须有明确客户名或ID；全部订单 -> 订单列表，只能配合客户/时间/订单页查看；最近/今天/昨天/本月 -> 时间范围，可默认今天；加单/追加 -> 订单修改，必须有目标订单或可靠上下文；商品销量 -> 商品统计，缺商品或统计口径时要反问。',
        '边界示例：用户说“哪个客户的全部订单”，不能查全部订单，必须反问“请指定客户名称或ID”。用户说“勇哥全部订单”，可以理解为客户勇哥的订单，但列表最多只应显示摘要。用户说“加单榴莲30件”，如果没有上一单上下文或订单号，必须反问加到哪一单。用户说“合并哪两单”，没有查询结果时不能编订单号。',
        '如果缺少必要信息，输出给用户的只是一句反问，不要编造条件，不要瞎查。',
        '不要编造订单号、客户名、金额、商品、库存、欠款等数据库事实；没有后端查询结果时，只能说明需要查询数据库或让用户补充条件。',
        '如果用户问“合并哪两单”“勇哥订单是哪几笔”这类具体数据库问题，而你没有工具结果，就请用户先查询或指定订单号。',
        '回答要短，先给结论，再给下一步。'
      ].join('\n')
    },
    ...userMessages
  ]
}

function buildIntentMessages(input: ClientMessage): ChatMessage[] {
  const history = Array.isArray(input.messages)
    ? input.messages.filter(item => item && item.role && item.content).slice(-6)
    : []
  const content = String(input.content || '').trim()
  const pendingDraftText = input.context?.pendingDraft
    ? `当前未确认草稿上下文：${JSON.stringify(input.context.pendingDraft)}`
    : ''

  return [
    {
      role: 'system',
      content: [
        '你只负责把东成果业水果批发对话解析成 JSON，不要输出解释、Markdown 或多余文本。',
        '支持 intent：query_orders、query_goods、query_debts、query_profit、query_supermarket_orders、query_customer、create_order、append_order、chat、unknown。',
        '数据库字段词典：客户 customers.id/name/partial_payment；订单 orders.id/order_no/customer_id/customer_name/status/paid_at/created_at/total_amount/commission/profit_amount；订单明细 order_items.goods_name/quantity/weight/price/commission/subtotal；库存 goods.name/unit_type/sale_price/default_commission/stock/cost_price；超市配送 supermarket_orders.supermarket_name/status/created_at/total_amount/total_profit。',
        '业务词映射：哪个客户/客户/客人 -> query_customer 或 customerName；全部订单/所有订单 -> query_orders + dateRange=all；最近/今天/昨天/本月/上月 -> created_at 时间范围；未付/未付款/未结账/欠款 -> status=unpaid；已付/已付款/已结账/付清 -> status=paid；毁单/取消/作废 -> status=cancelled；付款时间/什么时候付 -> paid_at。',
        '功能映射：查库存/还有多少/缺货/零库存 -> query_goods，商品名放 goodsName；查欠款/谁欠钱/客户欠账 -> query_debts，客户名放 customerName；查利润/销售额/赚了多少 -> query_profit；查超市配送/商超订单 -> query_supermarket_orders，超市名放 supermarketName。',
        '字段规则：customerName 是客户名；orderNo 是 DD 开头订单号；dateRange 只能是 today、yesterday、this_month、last_month、all、unspecified；status 只能是 paid、unpaid、cancelled、all、unspecified。',
        '库存规则：query_goods 可使用 goodsName、lowStock、zeroStock、limit。用户说“低库存/快没了” lowStock=true；说“没货/零库存/缺货” zeroStock=true。',
        'items 数组字段：goodsName、quantity、weight、price、commission。数量通常是“件/箱/筐/袋”，重量通常是“斤/公斤/kg”，价格是用户明确说的售价；用户没说佣金时 commission 必须是 null，留给后端用库存默认佣金。',
        'append_order 如果用户说“再加单/追加/加单”且存在当前未确认草稿，表示把新增商品合并进这个草稿；如果没有草稿但上下文能指向上一单，可使用上下文客户或订单；不能确定目标订单时 needsClarification=true，并给 clarification。',
        'query_customer 用于“是否有某客户/查某客户”。query_orders 用于查订单、订单列表、客户订单、全部订单。',
        '用户输入示例“勇哥拿货蓝莓20件100元无籽20件200斤4元”应解析为 create_order，客户勇哥，两行商品：蓝莓20件100元；无籽20件200斤4元。',
        '只输出一个 JSON 对象，格式如 {"intent":"create_order","confidence":0.9,"customerName":"勇哥","dateRange":"unspecified","status":"unspecified","items":[{"goodsName":"蓝莓","quantity":20,"weight":null,"price":100,"commission":null}],"needsClarification":false,"clarification":""}。'
      ].join('\n')
    },
    ...(pendingDraftText ? [{ role: 'system' as const, content: pendingDraftText }] : []),
    ...history,
    { role: 'user', content }
  ]
}

function shouldExtractStructuredIntent(input: ClientMessage) {
  const content = String(input.content || '').trim()
  if (!content) return false
  if (input.context?.pendingDraft) return true

  return /(拿货|买了|购买|下单|出单|开单|进货|订货|消费|要货|加单|追加|再加|补加|查询|查|看|找|统计|算|输出|列出|显示|汇总|合计|订单|单子|库存|存货|剩余|缺货|零库存|没货|欠款|欠账|欠帐|未收|未付款|没付款|赊账|利润|盈利|赚了|毛利|成本|销售额|营收|超市|配送|送货|商超|客户|\d+(?:\.\d+)?(?:件|个|箱|包|筐|袋|斤|公斤|千克|kg|KG|元|块钱|块))/i.test(content)
}

function parseJsonObject(text: string): AiStructuredIntent | null {
  const raw = String(text || '').trim()
  const jsonText = raw.startsWith('{') ? raw : raw.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) return null
  try {
    const parsed = JSON.parse(jsonText)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

async function extractStructuredIntent(input: ClientMessage): Promise<AiStructuredIntent | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const { apiKey, model, endpoint } = getLlmConfig()
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: buildIntentMessages(input),
        temperature: 0,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) return null
    const result = await response.json().catch(() => null)
    const content = result?.choices?.[0]?.message?.content || ''
    return parseJsonObject(content)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function streamLlm(peer: any, input: ClientMessage) {
  const { apiKey, model, endpoint } = getLlmConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  let response: Response

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: true,
        messages: buildMessages(input),
        temperature: 0.2,
        max_tokens: 800
      })
    })
  } catch (error: any) {
    clearTimeout(timeout)
    if (error?.name === 'AbortError') {
      throw new Error('AI 响应超时，请稍后重试')
    }
    throw error
  }

  if (!response.ok || !response.body) {
    clearTimeout(timeout)
    const text = await response.text().catch(() => '')
    const parsed = (() => {
      try {
        return JSON.parse(text)
      } catch {
        return null
      }
    })()
    const message = parsed?.error?.message || parsed?.message || text || `LLM 请求失败：${response.status}`
    throw new Error(message)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') {
          return answer
        }

        const json = JSON.parse(data)
        const delta = json?.choices?.[0]?.delta?.content || ''
        if (delta) {
          answer += delta
          sendJson(peer, { type: 'delta', content: delta })
        }
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  return answer
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

    let input: ClientMessage
    try {
      input = JSON.parse(message.text())
    } catch {
      sendJson(peer, { type: 'error', message: '消息格式错误' })
      return
    }

    const content = String(input.content || '').trim()
    const hasMessages = Array.isArray(input.messages) && input.messages.length > 0
    if (input.type !== 'message' || (!content && !hasMessages)) {
      sendJson(peer, { type: 'error', message: '请输入要发送的内容' })
      return
    }

    try {
      sendJson(peer, { type: 'start' })
      await prisma.$transaction(async (tx) => {
        await saveAiChatMessage(tx, {
          staffId: peer.context.staff.id,
          role: 'user',
          content
        })
        await trimAiChatMessages(tx, peer.context.staff.id)
      })

      const structuredIntent = shouldExtractStructuredIntent(input)
        ? await extractStructuredIntent(input)
        : null
      const dataAnswer = await answerAiDataQuestion(content, peer.context.staff.id, {
        structuredIntent,
        messages: input.messages || [],
        pendingDraft: input.context?.pendingDraft as any
      })
      if (dataAnswer.handled) {
        const answer = dataAnswer.answer || '没有查询到相关数据。'
        sendJson(peer, {
          type: 'result',
          content: answer,
          action: dataAnswer.action || null
        })
        await prisma.$transaction(async (tx) => {
          await saveAiChatMessage(tx, {
            staffId: peer.context.staff.id,
            role: 'assistant',
            content: answer
          })
          await trimAiChatMessages(tx, peer.context.staff.id)
        })
        sendJson(peer, { type: 'done' })
        return
      }

      const answer = await streamLlm(peer, input)
      await prisma.$transaction(async (tx) => {
        await saveAiChatMessage(tx, {
          staffId: peer.context.staff.id,
          role: 'assistant',
          content: answer
        })
        await trimAiChatMessages(tx, peer.context.staff.id)
      })
      sendJson(peer, { type: 'done' })
    } catch (error: any) {
      const messageText = String(error?.message || 'AI 对话失败')
      sendJson(peer, { type: 'error', message: messageText })
    }
  }
})
