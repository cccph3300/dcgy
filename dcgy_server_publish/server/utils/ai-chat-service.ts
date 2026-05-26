import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { saveAiChatMessage, trimAiChatMessages } from './ai-chat-history'
import { answerAiDataQuestion, type AiStructuredIntent } from './ai-data-actions'

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiChatInput = {
  content?: string
  messages?: AiChatMessage[]
  context?: {
    pendingDraft?: unknown
  }
}

type LlmConfig = {
  apiKey: string
  model: string
  endpoint: string
}

type StreamCallbacks = {
  onDelta?: (content: string) => void
}

function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, '') || ''
}

export function getLlmConfig(): LlmConfig {
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

export function validateAiChatInput(input: AiChatInput) {
  const content = String(input.content || '').trim()
  const hasMessages = Array.isArray(input.messages) && input.messages.length > 0
  if (!content && !hasMessages) {
    throw new Error('请输入要发送的内容')
  }
  return { content, hasMessages }
}

function buildMessages(input: AiChatInput): AiChatMessage[] {
  const history = Array.isArray(input.messages)
    ? input.messages.filter(item => item && item.role && item.content).slice(-12)
    : []
  const content = String(input.content || '').trim()
  const userMessages = history.length ? history : [{ role: 'user' as const, content }]

  return [
    {
      role: 'system',
      content: [
        '你是东成果业的 AI 智能对话助手，熟悉水果批发订单、客户欠款、货主入账、库存和出单流程。',
        '所有涉及数据库的请求，必须先在心里完成意图拆解：1. 用户想操作什么实体；2. 有哪些筛选条件；3. 缺失哪些必要信息；4. 是否可以执行。',
        '不要直接生成 SQL，不要展示 SQL。后端会优先识别并处理数据库增删改查意图；你只负责未被规则命中的自然对话和补充追问。',
        '如果缺少必要信息，输出给用户的只是一句反问，不要编造条件，不要瞎查。',
        '不要编造订单号、客户名、金额、商品、库存、欠款等数据库事实；没有后端查询结果时，只能说明需要查询数据库或让用户补充条件。',
        '回答要短，先给结论，再给下一步。'
      ].join('\n')
    },
    ...userMessages
  ]
}

function buildIntentMessages(input: AiChatInput): AiChatMessage[] {
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
        '支持 intent：query_orders、query_goods、query_debts、query_profit、query_supermarket_orders、query_supplier_debts、query_supplier_entries、create_supplier_entry、query_customer、create_order、append_order、chat、unknown。',
        '数据库字段词典：客户 customers.id/name/partial_payment；订单 orders.id/order_no/customer_id/customer_name/status/paid_at/created_at/total_amount/commission/profit_amount；订单明细 order_items.goods_name/quantity/weight/price/commission/subtotal；库存 goods.name/unit_type/sale_price/default_commission/stock/cost_price；超市配送 supermarket_orders.supermarket_name/status/created_at/total_amount/total_profit；货主 suppliers.name/partial_payment；入账 supplier_entries.supplier_name/goods_name/status/created_at/quantity/weight/total_amount/total_commission/cost_price/commission/sale_price。',
        '业务词映射：哪个客户/客户/客人 -> query_customer 或 customerName；全部订单/所有订单 -> query_orders + dateRange=all；最近/今天/昨天/本月/上月 -> created_at 时间范围；未付/未付款/未结账/欠款 -> status=unpaid；已付/已付款/已结账/付清 -> status=paid；毁单/取消/作废 -> status=cancelled；付款时间/什么时候付 -> paid_at。',
        '功能映射：查库存/还有多少/缺货/零库存 -> query_goods，商品名放 goodsName；查欠款/谁欠钱/客户欠账 -> query_debts，客户名放 customerName；查货主欠款/欠哪个货主/总共欠货主多少钱/欠某货主多少钱 -> query_supplier_debts，货主名放 supplierName；查入账记录/拿货记录/某货物哪天入账 -> query_supplier_entries，货主名放 supplierName，货物名放 goodsName；用户说“入账，在某货主拿了某货物，总共多少钱” -> create_supplier_entry；查利润/销售额/赚了多少 -> query_profit；查超市配送/商超订单 -> query_supermarket_orders，超市名放 supermarketName。',
        '货主欠款规则：用户问“总共欠货主多少钱 / 还有哪些货主没给钱 / 哪里货主没给钱 / 欠哪个货主”时是全体货主汇总，supplierName 必须为空；只有出现明确货主名称，例如“批发市场A老板”，才填写 supplierName。',
        '字段规则：customerName 是客户名；supplierName 是货主名；goodsName 是货物名；orderNo 是 DD 开头订单号；dateRange 只能是 today、yesterday、this_month、last_month、all、unspecified；status 只能是 paid、unpaid、cancelled、all、unspecified。',
        '库存规则：query_goods 可使用 goodsName、lowStock、zeroStock、limit。用户说“低库存/快没了” lowStock=true；说“没货/零库存/缺货” zeroStock=true。',
        'items 数组字段：goodsName、quantity、weight、price、commission。数量通常是“件/箱/筐/袋”，重量通常是“斤/公斤/kg”，价格是用户明确说的售价；用户没说佣金时 commission 必须是 null，留给后端用库存默认佣金。create_supplier_entry 不需要输出明细字段，后端会从原句二次解析；用户没说佣金时默认0。',
        'append_order 如果用户说“再加单/追加/加单”且存在当前未确认草稿，表示把新增商品合并进这个草稿；如果没有草稿但上下文能指向上一单，可使用上下文客户或订单；不能确定目标订单时 needsClarification=true，并给 clarification。',
        '只输出一个 JSON 对象。'
      ].join('\n')
    },
    ...(pendingDraftText ? [{ role: 'system' as const, content: pendingDraftText }] : []),
    ...history,
    { role: 'user', content }
  ]
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

export function shouldExtractStructuredIntent(input: AiChatInput) {
  const content = String(input.content || '').trim()
  if (!content) return false
  if (input.context?.pendingDraft) return true

  return /(拿货|买了|购买|下单|出单|开单|进货|订货|消费|要货|加单|追加|再加|补加|查询|查|看|找|统计|算|输出|列出|显示|汇总|合计|订单|单子|库存|存货|剩余|缺货|零库存|没货|欠款|欠账|欠帐|未收|未付款|没付款|赊账|利润|盈利|赚了|毛利|成本|销售额|营收|超市|配送|送货|商超|客户|货主|供货商|供应商|入账|入帐|拿货记录|进货记录|\d+(?:\.\d+)?(?:件|个|箱|包|筐|袋|斤|公斤|千克|kg|KG|元|块钱|块))/i.test(content)
}

export async function extractStructuredIntent(input: AiChatInput): Promise<AiStructuredIntent | null> {
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

export async function streamLlmAnswer(input: AiChatInput, callbacks: StreamCallbacks = {}) {
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
        if (data === '[DONE]') return answer

        const json = JSON.parse(data)
        const delta = json?.choices?.[0]?.delta?.content || ''
        if (delta) {
          answer += delta
          callbacks.onDelta?.(delta)
        }
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  return answer
}

export async function saveChatMessage(tx: Prisma.TransactionClient, staffId: number, role: 'user' | 'assistant', content: string) {
  await saveAiChatMessage(tx, { staffId, role, content })
  await trimAiChatMessages(tx, staffId)
}

export async function answerAiChat(input: AiChatInput, staffId: number, callbacks: StreamCallbacks = {}) {
  const { content } = validateAiChatInput(input)
  await prisma.$transaction(tx => saveChatMessage(tx, staffId, 'user', content))

  const structuredIntent = shouldExtractStructuredIntent(input)
    ? await extractStructuredIntent(input)
    : null
  const dataAnswer = await answerAiDataQuestion(content, staffId, {
    structuredIntent,
    messages: input.messages || [],
    pendingDraft: input.context?.pendingDraft as any
  })

  const answer = dataAnswer.handled
    ? (dataAnswer.answer || '没有查询到相关数据。')
    : await streamLlmAnswer(input, callbacks)

  await prisma.$transaction(tx => saveChatMessage(tx, staffId, 'assistant', answer))

  return {
    content: answer,
    action: dataAnswer.action || null
  }
}
