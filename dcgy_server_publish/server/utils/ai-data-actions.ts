import type { Prisma } from '@prisma/client'
import { createError } from 'h3'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from './prisma'
import { chinaDayRange, chinaMonthRange, todayInChina } from './date-query'
import { formatDecimal } from './number'
import { buildOrderItems, createOrderNo, deductStock, mapOrderItem, restoreStock } from './orders'
import { recalculateCustomerDebt } from './customer-payments'
import { buildSupplierEntryInput, createSupplierEntryNo, mapSupplierEntry, recalculateSupplierDebt, upsertSupplierStockGoods } from './supplier-entries'

type AiTable = {
  title: string
  columns: string[]
  rows: string[][]
}

type QueryOrdersAction = {
  kind: 'query_orders'
  title: string
  summary: string
  table: AiTable
  orders: Array<{
    id: number
    orderNo: string
    customerName: string
    status: string
    totalAmount: number
  }>
}

type QueryTableAction = {
  kind: 'query_goods' | 'query_debts' | 'query_profit' | 'query_supermarket_orders' | 'query_supplier_debts' | 'query_supplier_entries'
  title: string
  summary: string
  table: AiTable
}

type CreateOrderAction = {
  kind: 'create_order'
  title: string
  summary: string
  token: string
  draft: {
    customerName: string
    items: DraftItem[]
  }
  table: AiTable
  totalAmount: number
  goodsAmount: number
  commission: number
  rowCount: number
}

type SupplierEntryDraft = {
  supplierName: string
  goodsName: string
  unitType: 'weight' | 'qty'
  quantity: number
  weight: number | null
  totalAmount: number
  totalCommission: number
  costPrice: number
  commission: number
  saleCommission: number
  salePrice: number
  stockMode: 'auto_stocked' | 'record_only'
}

type CreateSupplierEntryAction = {
  kind: 'create_supplier_entry'
  title: string
  summary: string
  token: string
  draft: SupplierEntryDraft
  table: AiTable
}

type AppendOrderAction = CreateOrderAction & {
  operation: 'append_order'
  targetOrder: {
    id: number
    orderNo: string
    customerName: string
    totalAmount: number
  }
  draft: {
    customerName: string
    items: DraftItem[]
  }
}

type GoodsMutationOperation = 'delete' | 'clear' | 'increase' | 'set' | 'create'

type GoodsMutationDraft = {
  operation: GoodsMutationOperation
  goodsId?: number
  goodsName: string
  quantity?: number | null
  unitType?: 'weight' | 'qty'
  salePrice?: number | null
  costPrice?: number | null
  defaultCommission?: number | null
  saleCommission?: number | null
}

type GoodsMutationAction = {
  kind: 'goods_mutation'
  title: string
  summary: string
  token: string
  mutation: GoodsMutationDraft
  table: AiTable
}

type AiAction = QueryOrdersAction | QueryTableAction | CreateOrderAction | AppendOrderAction | GoodsMutationAction | CreateSupplierEntryAction

type AiDataResult = {
  handled: boolean
  answer?: string
  action?: AiAction
}

type AiContextMessage = {
  role?: string
  content?: string
}

type PendingDraftContext = {
  operation?: 'create_order' | 'append_order' | string
  customerName?: string
  targetOrder?: {
    id?: number
    orderNo?: string
    customerName?: string
    totalAmount?: number
  } | null
  items?: Array<{
    goodsId?: number
    goodsName?: string
    unitType?: 'weight' | 'qty' | string
    quantity?: number
    weight?: number | null
    price?: number
    commission?: number | null
  }>
}

type AiDataContext = {
  messages?: AiContextMessage[]
  structuredIntent?: AiStructuredIntent | null
  pendingDraft?: PendingDraftContext | null
}

type AiConversationContext = {
  customerName?: string
  orderNo?: string
}

type AiIntentPlan = {
  entity: '订单' | '商品' | '客户' | '未知'
  action: 'query' | 'create' | 'append' | 'chat'
  sqlReady: boolean
  missingFields: string[]
  questionToUser?: string
}

type DraftItem = {
  goodsId: number
  goodsName: string
  unitType: 'weight' | 'qty'
  quantity: number
  weight: number | null
  price: number
  commission: number
  subtotal: number
}

type DraftPayload = {
  kind: 'create_order' | 'append_order' | 'goods_mutation' | 'create_supplier_entry'
  staffId: number
  expiresAt: string
  orderId?: number
  goodsMutation?: GoodsMutationDraft
  supplierEntry?: SupplierEntryDraft
}

type ParsedDraft = {
  customerName: string
  items: Array<{
    rawGoodsName: string
    quantity: number
    weight: number | null
    price: number | null
    commission: number | null
  }>
}

export type AiStructuredIntent = {
  intent?: 'query_orders' | 'query_goods' | 'query_debts' | 'query_profit' | 'query_supermarket_orders' | 'query_supplier_debts' | 'query_supplier_entries' | 'create_supplier_entry' | 'create_order' | 'append_order' | 'query_customer' | 'chat' | 'unknown'
  confidence?: number
  customerName?: string
  supplierName?: string
  goodsName?: string
  supermarketName?: string
  orderNo?: string
  dateRange?: 'today' | 'yesterday' | 'this_month' | 'last_month' | 'all' | 'unspecified' | string
  status?: 'paid' | 'unpaid' | 'cancelled' | 'all' | 'unspecified' | string
  lowStock?: boolean
  zeroStock?: boolean
  limit?: number | string
  target?: {
    orderNo?: string
    customerName?: string
    latest?: boolean
  }
  items?: Array<{
    goodsName?: string
    name?: string
    quantity?: number | string
    weight?: number | string | null
    price?: number | string | null
    commission?: number | string | null
  }>
  needsClarification?: boolean
  clarification?: string
}

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>

const AI_OPERATION_TTL_MS = 15 * 60 * 1000
const QUERY_TAKE_DEFAULT = 20
const QUERY_TAKE_ALL = 20
const CREATE_WORDS = '拿货|买了|购买|下单|出单|开单|进货|订货|消费|要货'
const APPEND_WORDS = '加单|追加|再加|补加|加上|添上|补一单|追加到'
const QUERY_WORDS = '查询|查|看|找|统计|算|输出|列出|显示|汇总|合计|多少钱|多少金额|拿了多少|下单多少'
const ORDER_WORDS = '订单|单子|单|记录|明细|出单|下单|拿货|全部订单|所有订单'
const PRODUCT_WORDS = '产品|商品|货物|水果|苹果|香蕉|榴莲|蓝莓|车厘子|销量|卖得'
const INVENTORY_WORDS = '库存|存货|剩余|还有多少|缺货|零库存|没货'
const INVENTORY_MUTATION_WORDS = '删除|删掉|移除|停用|清空|清零|归零|入库|补货|加库存|增加库存|改库存|设库存|设置库存|库存改成|库存设为'
const DEBT_WORDS = '欠款|欠账|欠帐|未收|未付款|没付款|赊账|客户欠款'
const PROFIT_WORDS = '利润|盈利|赚了|毛利|成本|销售额|营收'
const SUPERMARKET_WORDS = '超市|配送|送货|商超'
const SUPPLIER_WORDS = '货主|供货商|供应商|上家'
const SUPPLIER_ENTRY_WORDS = '入账|入的账|入帐|拿货记录|进货记录|货主记录'
const SUPPLIER_ENTRY_CREATE_WORDS = '入账|入帐|拿了|拿货|进货|采购|到货'

function normalizeText(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[，,；;：:。！？!?、]/g, ' ')
    .trim()
}

function normalizeCompact(value: string) {
  return String(value || '')
    .replace(/\s/g, '')
    .replace(/[，,；;：:。！？!?、]/g, '')
}

function getOperationSecret() {
  return process.env.AI_OPERATION_SECRET?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.ZHIPU_API_KEY?.trim() ||
    'dcgy-ai-operation-secret'
}

function signDraft(payload: DraftPayload) {
  const raw = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sign = createHmac('sha256', getOperationSecret()).update(raw).digest('base64url')
  return `${raw}.${sign}`
}

function verifyDraft(token: string) {
  const [raw, sign] = String(token || '').split('.')
  if (!raw || !sign) return null
  const expected = createHmac('sha256', getOperationSecret()).update(raw).digest('base64url')
  const expectedBuf = Buffer.from(expected)
  const signBuf = Buffer.from(sign)
  if (expectedBuf.length !== signBuf.length) return null
  if (!timingSafeEqual(expectedBuf, signBuf)) return null

  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as DraftPayload
  } catch {
    return null
  }
}

function isExpired(expiresAt: string) {
  return Number(new Date(expiresAt)) <= Date.now()
}

function statusText(status: string) {
  if (status === 'paid') return '已付'
  if (status === 'unpaid') return '未付'
  if (status === 'cancelled') return '已毁单'
  return status
}

function formatOrderTime(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(value)
}

function currentChinaYear() {
  return Number(todayInChina().slice(0, 4))
}

function normalizeDateText(year: number, month: number, day: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return ''
  const check = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseFlexibleDateToken(token: string) {
  const text = String(token || '').trim()
  if (/^(今天|今日)$/.test(text)) return todayInChina()
  if (/^(昨天|昨日)$/.test(text)) {
    const todayRange = chinaDayRange(todayInChina())
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(todayRange.start.getTime() - 24 * 60 * 60 * 1000))
  }

  const full = text.match(/^(\d{4})[年\-/.](\d{1,2})[月\-/.](\d{1,2})(?:日|号)?$/)
  if (full) return normalizeDateText(Number(full[1]), Number(full[2]), Number(full[3]))

  const short = text.match(/^(\d{1,2})[月\-/.](\d{1,2})(?:日|号)?$/)
  if (short) return normalizeDateText(currentChinaYear(), Number(short[1]), Number(short[2]))

  return ''
}

function explicitDateRange(text: string) {
  const normalized = normalizeText(text)
  const dateToken = String.raw`(?:(?:\d{4}[年\-/.])?\d{1,2}[月\-/.]\d{1,2}(?:日|号)?|今天|今日|昨天|昨日)`
  const rangeMatch = normalized.match(new RegExp(`(${dateToken})\\s*(?:到|至|~|—|--|-)\\s*(${dateToken})`))
  if (rangeMatch) {
    const startDate = parseFlexibleDateToken(rangeMatch[1])
    const endDate = parseFlexibleDateToken(rangeMatch[2])
    if (startDate && endDate) {
      const startRange = chinaDayRange(startDate)
      const endRange = chinaDayRange(endDate)
      const start = startRange.start <= endRange.start ? startRange.start : endRange.start
      const end = startRange.start <= endRange.start ? endRange.end : startRange.end
      return { label: `${startDate}到${endDate}`, start, end }
    }
  }

  const singleMatch = normalized.match(new RegExp(`(${dateToken})`))
  if (singleMatch) {
    const date = parseFlexibleDateToken(singleMatch[1])
    if (date) return { label: date, ...chinaDayRange(date) }
  }

  return null
}

function getDateRange(text: string) {
  const normalized = normalizeCompact(text)
  const explicitRange = explicitDateRange(text)
  if (explicitRange) return explicitRange

  if (/(全部|所有|历史|历史订单|全部时间|不限时间)/.test(normalized)) {
    return { label: '全部' }
  }
  if (/(昨天|昨日)/.test(normalized)) {
    const today = todayInChina()
    const todayRange = chinaDayRange(today)
    const yesterday = new Date(todayRange.start.getTime() - 24 * 60 * 60 * 1000)
    const dateText = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(yesterday)
    return { label: '昨天', ...chinaDayRange(dateText) }
  }
  if (/(上月|上个月)/.test(normalized)) {
    const current = todayInChina()
    const [year, month] = current.split('-').map(Number)
    const prevMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(Date.UTC(year, month - 2, 1, -8, 0, 0, 0)))
    return { label: '上月', ...chinaMonthRange(prevMonth) }
  }
  if (/(本月|这个月|当月|月内)/.test(normalized)) {
    return { label: '本月', ...chinaMonthRange(todayInChina()) }
  }
  return { label: '今天', ...chinaDayRange(todayInChina()) }
}

function dateWhere(range: { start?: Date, end?: Date }) {
  return range.start && range.end ? { gte: range.start, lt: range.end } : undefined
}

function hasDateHint(text: string) {
  const normalized = normalizeCompact(text)
  return /(今天|今日|昨天|昨日|本月|这个月|当月|月内|上月|上个月|\d{4}[年\-/.]\d{1,2}[月\-/.]\d{1,2}(?:日|号)?|\d{1,2}[月\-/.]\d{1,2}(?:日|号)?)/.test(normalized)
}

function normalizeOrderStatus(value: unknown) {
  const text = normalizeCompact(String(value || ''))
  if (!text || text === 'all' || text === 'unspecified') return ''
  if (/(未付|未付款|未结账|没付|欠款|赊账|unpaid)/i.test(text)) return 'unpaid'
  if (/(已付|已付款|已结账|付清|结清|paid)/i.test(text)) return 'paid'
  if (/(毁单|取消|作废|cancelled|canceled)/i.test(text)) return 'cancelled'
  return ''
}

function normalizeSupermarketStatus(value: unknown) {
  const text = normalizeCompact(String(value || ''))
  if (!text || text === 'all' || text === 'unspecified') return ''
  if (/(未付|未付款|未结账|进行中|未完成|active)/i.test(text)) return 'active'
  if (/(已付|已付款|已结账|付清|paid)/i.test(text)) return 'paid'
  if (/(毁单|取消|作废|cancelled|canceled)/i.test(text)) return 'cancelled'
  return ''
}

function normalizeSupplierEntryStatus(value: unknown) {
  const text = normalizeCompact(String(value || ''))
  if (!text || text === 'all' || text === 'unspecified') return ''
  if (/(未付|未付款|未结账|没付|欠款|赊账|unpaid)/i.test(text)) return 'unpaid'
  if (/(已付|已付款|已结账|付清|结清|paid)/i.test(text)) return 'paid'
  return ''
}

function limitedTake(value: unknown, fallback = 20, max = 50) {
  const numberValue = Number(value || fallback)
  if (!Number.isFinite(numberValue)) return fallback
  return Math.min(Math.max(Math.floor(numberValue), 1), max)
}

function getDateRangeByKey(key: unknown, fallbackText: string) {
  const value = String(key || '').trim()
  if (hasDateHint(fallbackText)) return getDateRange(fallbackText)
  if (value === 'all') return { label: '全部' }
  if (value === 'yesterday') {
    const today = todayInChina()
    const todayRange = chinaDayRange(today)
    const yesterday = new Date(todayRange.start.getTime() - 24 * 60 * 60 * 1000)
    const dateText = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(yesterday)
    return { label: '昨天', ...chinaDayRange(dateText) }
  }
  if (value === 'last_month') {
    const current = todayInChina()
    const [year, month] = current.split('-').map(Number)
    const prevMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(Date.UTC(year, month - 2, 1, -8, 0, 0, 0)))
    return { label: '上月', ...chinaMonthRange(prevMonth) }
  }
  if (value === 'this_month') return { label: '本月', ...chinaMonthRange(todayInChina()) }
  if (value === 'today') return { label: '今天', ...chinaDayRange(todayInChina()) }
  return getDateRange(fallbackText)
}

function cleanName(value: string) {
  return normalizeText(value)
    .replace(/^(帮我|麻烦|请帮我|请|我要|我想|帮忙|给|把|替)/, '')
    .replace(new RegExp(`(${QUERY_WORDS}|${CREATE_WORDS}|${APPEND_WORDS})`, 'g'), '')
    .replace(/(今天|今日|昨天|昨日|本月|这个月|当月|月内|上月|全部|所有|历史|现在|当前|刚才|刚刚|最近|最后|最新|第\d+笔|第\d+单)/g, '')
    .replace(/(订单记录|订单明细|订单详情|全部订单|所有订单|订单|单子|单|记录|明细|金额|钱|元|块钱|块)/g, '')
    .replace(/\d+(?:\.\d+)?/g, '')
    .trim()
}

function isMeaningfulCustomerName(value: string) {
  const name = cleanName(value)
  if (!name) return ''
  if (/^(客户|全部客户|全部|所有|订单|这单|当前|最新|上一)$/.test(name)) return ''
  return name.length <= 20 ? name : ''
}

function extractQueryCustomerName(text: string) {
  const normalized = normalizeText(text)
  const compact = normalizeCompact(text)
  if (/(全部|所有|历史).*(订单|单子|单|出单|下单)|(订单|单子|单).*(全部|所有|历史)/.test(compact)) {
    const allOrderMatch = normalized.match(/(?:帮我|麻烦|请帮我|请)?(?:查询|查|查看|看|找|统计|算|输出|列出|显示|汇总)?(.+?)(?:的)?(?:全部|所有|历史)(?:订单|单子|单|出单|下单)/)
    return allOrderMatch?.[1] ? isMeaningfulCustomerName(allOrderMatch[1]) : ''
  }

  const patterns = [
    /(?:帮我|麻烦|请帮我|请)?(?:查询|查|看|找|统计|算|输出|列出|显示|汇总)?(.+?)(?:今天|今日|昨天|昨日|本月|这个月|全部|所有|历史)?(?:的)?(?:订单|单子|单|记录|明细|下单|拿货|消费)(?:多少钱|多少金额|金额|合计|输出|明细)?$/,
    /(?:帮我|麻烦|请帮我|请)?(?:查询|查|看|找|统计|算|输出|列出|显示|汇总)(.+?)(?:多少钱|多少金额|金额|合计)?$/
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match?.[1]) continue
    const name = isMeaningfulCustomerName(match[1])
    if (name) return name
  }

  return isMeaningfulCustomerName(normalized)
}

function isOrderQuery(text: string) {
  const normalized = normalizeCompact(text)
  if (isAppendIntent(text)) return false
  const hasQueryIntent = new RegExp(`(${QUERY_WORDS})`).test(normalized)
  const hasOrderSubject = new RegExp(`(${ORDER_WORDS})`).test(normalized)
  const asksMoney = /(多少钱|多少金额|拿了多少|下单多少|合计|总额|总共)/.test(normalized)
  const asksAllOrders = /(全部|所有|历史).*(订单|单子|单|出单|下单)|(订单|单子|单).*(全部|所有|历史)/.test(normalized)
  const namedOrder = hasOrderSubject && Boolean(extractQueryCustomerName(text))
  return (hasQueryIntent && hasOrderSubject) || (asksMoney && hasOrderSubject) || asksAllOrders || namedOrder
}

function isAppendIntent(text: string) {
  return new RegExp(`(${APPEND_WORDS})`).test(normalizeCompact(text))
}

function isCreateIntent(text: string) {
  const normalized = normalizeCompact(text)
  return new RegExp(`(${CREATE_WORDS})`).test(normalized) || /\d+(?:\.\d+)?(?:件|个|箱|包|筐|袋)/.test(normalized)
}

function isAmbiguousCustomerQuestion(text: string) {
  const normalized = normalizeCompact(text)
  return /^(哪个|哪位|什么|谁).*(客户|客人|老板).*(全部|所有|历史)?(订单|单子|单)/.test(normalized) ||
    /^(全部|所有|历史)?(订单|单子|单).*(哪个|哪位|什么|谁).*(客户|客人|老板)/.test(normalized)
}

function isInventoryQuery(text: string) {
  const normalized = normalizeCompact(text)
  return new RegExp(`(${INVENTORY_WORDS})`).test(normalized) ||
    (new RegExp(`(${PRODUCT_WORDS})`).test(normalized) && new RegExp(`(${QUERY_WORDS})`).test(normalized))
}

function isInventoryMutation(text: string) {
  const normalized = normalizeCompact(text)
  if (!new RegExp(`(${INVENTORY_MUTATION_WORDS})`).test(normalized)) return false
  return new RegExp(`(${INVENTORY_WORDS})`).test(normalized) ||
    new RegExp(`(${PRODUCT_WORDS})`).test(normalized) ||
    /[\u4e00-\u9fa5A-Za-z0-9]{1,30}(入库|补货|加库存|增加库存|清空|清零|归零|删除|删掉|移除|停用|改库存|设库存|设置库存)/.test(normalized)
}

function isDebtQuery(text: string) {
  return new RegExp(`(${DEBT_WORDS})`).test(normalizeCompact(text))
}

function isProfitQuery(text: string) {
  return new RegExp(`(${PROFIT_WORDS})`).test(normalizeCompact(text))
}

function isSupermarketOrderQuery(text: string) {
  const normalized = normalizeCompact(text)
  return new RegExp(`(${SUPERMARKET_WORDS})`).test(normalized) && new RegExp(`(${QUERY_WORDS}|${ORDER_WORDS}|${PROFIT_WORDS})`).test(normalized)
}

function isSupplierEntryQuery(text: string) {
  const normalized = normalizeCompact(text)
  return new RegExp(`(${SUPPLIER_ENTRY_WORDS})`).test(normalized) &&
    new RegExp(`(${QUERY_WORDS}|${SUPPLIER_WORDS}|哪天|什么时候|日期|明细|记录|全部|所有|今天|昨天|本月|上月)`).test(normalized)
}

function isSupplierDebtQuery(text: string) {
  const normalized = normalizeCompact(text)
  if (!new RegExp(`(${SUPPLIER_WORDS})`).test(normalized)) return false
  return /(欠|欠款|欠账|欠帐|未付|未付款|没付|没给钱|还没给|多少钱|总共|合计|赊账|没结清|没结账)/.test(normalized)
}

function extractGoodsQueryName(text: string) {
  return normalizeText(text)
    .replace(new RegExp(`(${QUERY_WORDS}|${INVENTORY_WORDS}|产品|商品|货物|水果)`, 'g'), '')
    .replace(/(今天|昨日|昨天|本月|上月|全部|所有|最近|当前|现在|一下|还有多少|多少)/g, '')
    .trim()
}

function cleanSupplierKeyword(value: string) {
  const cleaned = normalizeText(value)
    .replace(new RegExp(`(${QUERY_WORDS}|${DEBT_WORDS}|${SUPPLIER_WORDS}|${SUPPLIER_ENTRY_WORDS}|多少钱|多少|总共|一共|共|总计|合计|欠|没给钱|没付清|未付清|已付清|未结清|已结清|没结清|没付|未付|已付|付清|结清|记录|明细|日期|哪天|什么时候|paid|unpaid|all)`, 'gi'), ' ')
    .replace(/(今天|今日|昨天|昨日|本月|这个月|当月|月内|上月|上个月|全部|所有|历史|不限时间|最近|当前|现在|一下|从|到|至|起|的)/g, ' ')
    .replace(/\d{4}[年\-/.]\d{1,2}[月\-/.]\d{1,2}(?:日|号)?/g, ' ')
    .replace(/\d{1,2}[月\-/.]\d{1,2}(?:日|号)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (/^(哪|哪里|哪些|谁|什么|多少|所有|全部|总共|一共|合计|欠|清|的|到|至|从|all|paid|unpaid|们|各位|大家|货主|货主们|供应商|供应商们|供货商|供货商们)$/i.test(cleaned)) return ''
  return cleaned.length <= 80 ? cleaned : ''
}

function extractSupplierName(text: string) {
  const normalized = normalizeText(text)
  const patterns = [
    /欠(.+?)(?:货主|供货商|供应商|上家)?(?:多少钱|多少|欠款|欠账|欠帐|钱)?$/,
    /(.+?)(?:货主|供货商|供应商|上家)(?:欠|未付|没付|没给钱|多少钱|多少|赊账)/,
    /(?:货主|供货商|供应商|上家)(.+?)(?:欠|未付|没付|没给钱|多少钱|多少|赊账)/,
    /(?:查|查询|看|统计|显示|列出)?(.+?)(?:的)?(?:货主欠款|货主欠账|货主赊账|赊账详情)/
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const name = match?.[1] ? cleanSupplierKeyword(match[1]) : ''
    if (name) return name
  }
  return ''
}

function extractSupplierEntryKeyword(text: string) {
  const normalized = normalizeText(text)
  const patterns = [
    /(?:查|查询|看|统计|显示|列出)?(.+?)(?:哪天|什么时候)(?:入账|入的账|入帐)/,
    /(?:查|查询|看|统计|显示|列出)?(.+?)(?:的)?(?:入账记录|入帐记录|拿货记录|进货记录)/,
    /(?:入账|入帐|拿货|进货)(?:记录|明细)?(.+)$/
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const keyword = match?.[1] ? cleanSupplierKeyword(match[1]) : ''
    if (keyword) return keyword
  }
  return cleanSupplierKeyword(normalized)
}

function isSupplierEntryCreateIntent(text: string) {
  const normalized = normalizeCompact(text)
  if (!new RegExp(`(${SUPPLIER_ENTRY_CREATE_WORDS})`).test(normalized)) return false
  return /(入账|入帐)/.test(normalized) && /(在|从).+?(拿|进|采购|到货)|拿了|进了|采购/.test(normalized) && /(总共|总金额|合计|共)\d/.test(normalized)
}

function extractSupplierNameForEntryCreate(text: string) {
  const normalized = normalizeText(text)
  const patterns = [
    /(?:在|从)\s*(.+?)\s*(?:拿了|拿|进了|进货|采购|入了|到货)/,
    /(?:货主|供货商|供应商)\s*(.+?)\s*(?:拿了|拿|进了|进货|采购|入账|入帐)/
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const name = match?.[1] ? cleanSupplierKeyword(match[1]) : ''
    if (name) return name
  }
  return ''
}

function extractSupplierEntryGoodsName(text: string) {
  const normalized = normalizeText(text)
  const patterns = [
    /\d+(?:\.\d+)?\s*(?:件|个|箱|筐|袋|斤|公斤|千克|kg|KG)\s*([\u4e00-\u9fa5A-Za-z0-9]{1,40})/,
    /(?:拿了|拿|进了|进货|采购)\s*([\u4e00-\u9fa5A-Za-z0-9]{1,40})/
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match?.[1]) continue
    const name = cleanSupplierKeyword(match[1])
      .replace(/(总共|总金额|合计|佣金|按件|按斤|按重量|按个|算的).*$/g, '')
      .trim()
    if (name) return name
  }
  return ''
}

function extractAmountByWords(text: string, words: string) {
  const match = normalizeText(text).match(new RegExp(`(?:${words})\\s*([\\d.]+)\\s*(?:元|块钱|块)?`))
  return match?.[1] ? Number(match[1]) : 0
}

function extractSupplierEntryDraft(content: string): SupplierEntryDraft | string {
  const supplierName = extractSupplierNameForEntryCreate(content)
  const goodsName = extractSupplierEntryGoodsName(content)
  const quantityMatch = normalizeText(content).match(/(\d+(?:\.\d+)?)\s*(?:件|个|箱|筐|袋)/)
  const weightMatch = normalizeText(content).match(/(\d+(?:\.\d+)?)\s*(斤|公斤|千克|kg|KG)/)
  const quantity = quantityMatch?.[1] ? Number(quantityMatch[1]) : 0
  const rawWeight = weightMatch?.[1] ? Number(weightMatch[1]) : 0
  const weight = weightMatch?.[2] && /公斤|千克|kg|KG/.test(weightMatch[2]) ? rawWeight * 2 : rawWeight
  const totalAmount = extractAmountByWords(content, '总共|总金额|合计|共')
  const totalCommission = extractAmountByWords(content, '总佣金|佣金') || 0
  const unitType = /(按斤|按重量|按重|按斤算|按重量算|每斤)/.test(normalizeCompact(content)) ? 'weight' : 'qty'

  if (!supplierName) return '已识别为入账需求，但没有识别到货主。请说“在某某货主拿了...”'
  if (!goodsName) return '已识别为入账需求，但没有识别到品名。请补充品名。'
  if (!quantity || quantity <= 0) return `请补充“${goodsName}”的件数。`
  if (unitType === 'weight' && (!weight || weight <= 0)) return `按斤算时请补充“${goodsName}”的重量。`
  if (!totalAmount || totalAmount <= 0) return `请补充“${goodsName}”的总金额。`
  if (totalCommission < 0 || totalCommission > totalAmount) return '佣金不能小于0，也不能大于总金额。'

  const billingAmount = unitType === 'weight' ? weight : quantity
  const costPrice = Number(((totalAmount - totalCommission) / billingAmount).toFixed(2))
  const commission = Number((totalCommission / quantity).toFixed(2))
  return {
    supplierName,
    goodsName,
    unitType,
    quantity,
    weight: unitType === 'weight' ? Number(weight.toFixed(2)) : null,
    totalAmount: Number(totalAmount.toFixed(2)),
    totalCommission: Number(totalCommission.toFixed(2)),
    costPrice,
    commission,
    saleCommission: 0,
    salePrice: costPrice,
    stockMode: 'auto_stocked'
  }
}

function parseChineseNumber(value: string) {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized)
  const map: Record<string, number> = {
    零: 0,
    一: 1,
    两: 2,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  }
  if (normalized === '十') return 10
  const tenMatch = normalized.match(/^([一两二三四五六七八九])?十([一两二三四五六七八九])?$/)
  if (tenMatch) {
    return (tenMatch[1] ? map[tenMatch[1]] : 1) * 10 + (tenMatch[2] ? map[tenMatch[2]] : 0)
  }
  return map[normalized] ?? null
}

function extractNumberByPattern(text: string, pattern: RegExp) {
  const match = text.match(pattern)
  if (!match?.[1]) return null
  return parseChineseNumber(match[1])
}

function inferUnitTypeFromText(text: string) {
  return /(每斤|斤|公斤|千克|kg|KG|称重)/.test(text) ? 'weight' : 'qty'
}

function cleanInventoryGoodsName(text: string) {
  return normalizeGoodsName(text
    .replace(new RegExp(`(${INVENTORY_MUTATION_WORDS}|${INVENTORY_WORDS}|产品|商品|货物|水果)`, 'g'), ' ')
    .replace(/(?:每件|一件|每个|一个|每斤|一斤|售价|卖价|价格|单价|成本|成本价|成本佣金|售卖佣金|佣金|默认佣金)\s*[一两二三四五六七八九十\d]+(?:\.\d+)?\s*(?:元|块钱|块)?/g, ' ')
    .replace(/[一两二三四五六七八九十\d]+(?:\.\d+)?\s*(?:件|个|箱|包|筐|袋|斤|公斤|千克|kg|KG)/g, ' ')
    .replace(/^[一两二三四五六七八九十]+/, ' '))
}

function extractInventoryMutation(content: string) {
  const normalized = normalizeText(content)
  const compact = normalizeCompact(content)
  const operation = /(删除|删掉|移除|停用)/.test(compact)
    ? 'delete'
    : /(清空|清零|归零)/.test(compact)
      ? 'clear'
      : /(入库|补货|加库存|增加库存)/.test(compact)
        ? 'increase'
        : /(改库存|设库存|设置库存|库存改成|库存设为)/.test(compact)
          ? 'set'
          : ''
  const quantity = extractNumberByPattern(normalized, /([一两二三四五六七八九十\d]+(?:\.\d+)?)\s*(?:件|个|箱|包|筐|袋|斤|公斤|千克|kg|KG)/)
  const salePrice = extractNumberByPattern(normalized, /(?:每件|一件|每个|一个|每斤|一斤|售价|卖价|价格|单价)\s*([一两二三四五六七八九十\d]+(?:\.\d+)?)\s*(?:元|块钱|块)?/)
  const costPrice = extractNumberByPattern(normalized, /(?:成本|成本价)\s*([一两二三四五六七八九十\d]+(?:\.\d+)?)\s*(?:元|块钱|块)?/)
  const defaultCommission = extractNumberByPattern(normalized, /(?:成本佣金|拿货佣金|默认佣金|佣金)\s*([一两二三四五六七八九十\d]+(?:\.\d+)?)\s*(?:元|块钱|块)?/)
  const saleCommission = extractNumberByPattern(normalized, /(?:售卖佣金|卖货佣金|销售佣金)\s*([一两二三四五六七八九十\d]+(?:\.\d+)?)\s*(?:元|块钱|块)?/)
  const unitType = inferUnitTypeFromText(normalized)
  const goodsName = cleanInventoryGoodsName(normalized)

  return { operation, goodsName, quantity, salePrice, costPrice, defaultCommission, saleCommission, unitType }
}

function extractSupermarketName(text: string) {
  return normalizeText(text)
    .replace(new RegExp(`(${QUERY_WORDS}|${SUPERMARKET_WORDS}|${ORDER_WORDS}|${PROFIT_WORDS})`, 'g'), '')
    .replace(/(今天|昨日|昨天|本月|上月|全部|所有|最近|当前|现在|一下)/g, '')
    .trim()
}

function analyzeAiIntent(content: string, context: AiConversationContext = {}): AiIntentPlan {
  const normalized = normalizeCompact(content)
  const hasProductSubject = new RegExp(`(${PRODUCT_WORDS})`).test(normalized)

  if (isAppendIntent(content)) {
    const parsed = extractCreateSegments(content)
    const hasTargetOrder = Boolean(normalized.match(/DD\d{10,}/i)?.[0] || context?.orderNo || parsed.customerName || context?.customerName)
    if (!parsed.items.length) {
      return {
        entity: '订单',
        action: 'append',
        sqlReady: false,
        missingFields: ['append_items'],
        questionToUser: '你要给订单加什么商品？请按“商品名 + 数量 + 价格”告诉我，例如“加榴莲30件150元”。'
      }
    }
    if (!hasTargetOrder) {
      return {
        entity: '订单',
        action: 'append',
        sqlReady: false,
        missingFields: ['target_order'],
        questionToUser: '你要加到哪一单？请告诉我客户名、订单号，或者说“给上一单/最新一单加单”。'
      }
    }
    return { entity: '订单', action: 'append', sqlReady: true, missingFields: [] }
  }

  if (isAmbiguousCustomerQuestion(content)) {
    return {
      entity: '订单',
      action: 'query',
      sqlReady: false,
      missingFields: ['customer_identifier'],
      questionToUser: '请告诉我你想查看哪位客户的订单，可以发客户名称或客户ID。'
    }
  }

  if (isOrderQuery(content)) {
    return { entity: '订单', action: 'query', sqlReady: true, missingFields: [] }
  }

  if (isInventoryMutation(content)) {
    return { entity: '商品', action: 'query', sqlReady: true, missingFields: [] }
  }

  if (isInventoryQuery(content) || isDebtQuery(content) || isProfitQuery(content) || isSupermarketOrderQuery(content)) {
    return { entity: hasProductSubject ? '商品' : '订单', action: 'query', sqlReady: true, missingFields: [] }
  }

  if (isCreateIntent(content)) {
    const parsed = extractCreateSegments(content)
    if (!parsed.customerName && !context?.customerName) {
      return {
        entity: '订单',
        action: 'create',
        sqlReady: false,
        missingFields: ['customer_identifier'],
        questionToUser: '这单是哪个客户的？请补充客户名，例如“陈老 蓝莓20件50元”。'
      }
    }
    if (!parsed.items.length) {
      return {
        entity: '订单',
        action: 'create',
        sqlReady: false,
        missingFields: ['order_items'],
        questionToUser: '这单缺少商品明细。请补充商品名称、数量和价格。'
      }
    }
    return { entity: '订单', action: 'create', sqlReady: true, missingFields: [] }
  }

  return { entity: '未知', action: 'chat', sqlReady: false, missingFields: [] }
}

function stripBeforeAction(text: string, words: string) {
  const match = normalizeText(text).match(new RegExp(`^(.*?)(?:${words})(.+)$`))
  return {
    customerName: match ? cleanName(match[1]) : '',
    bodyText: match ? match[2].trim() : normalizeText(text)
  }
}

function normalizeGoodsName(value: string) {
  return value
    .replace(/^(每件|每个|单价|价格|价|每斤)\d+(?:\.\d+)?(元|块钱|块)?/, '')
    .replace(new RegExp(`^(帮我|麻烦|请帮我|请|我要|我想|给|把|替|${CREATE_WORDS}|${APPEND_WORDS})`), '')
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '')
    .trim()
}

function extractCreateSegments(text: string): ParsedDraft {
  const actionWords = `${CREATE_WORDS}|${APPEND_WORDS}`
  const actionResult = stripBeforeAction(text, actionWords)
  const bodyText = actionResult.bodyText
  const tokenPattern = /(\d+(?:\.\d+)?)(?:件|个|箱|包|筐|袋)/gi
  const tokens: Array<{ index: number, end: number, quantity: number }> = []
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(bodyText))) {
    tokens.push({
      index: match.index,
      end: match.index + match[0].length,
      quantity: Number(match[1] || 0)
    })
  }

  if (!tokens.length) {
    return { customerName: actionResult.customerName, items: [] }
  }

  let inferredCustomerName = actionResult.customerName

  const items = tokens.map((token, index) => {
    const prevEnd = index === 0 ? 0 : tokens[index - 1].end
    const nextStart = index + 1 < tokens.length ? tokens[index + 1].index : bodyText.length
    const head = bodyText.slice(prevEnd, token.index).trim()
    const tail = bodyText.slice(token.end, nextStart).trim()

    const headChunks = head.split(/\s+/).filter(Boolean)
    const rawGoodsName = headChunks[headChunks.length - 1] || head
    if (index === 0 && !inferredCustomerName && headChunks.length > 1) {
      inferredCustomerName = cleanName(headChunks.slice(0, -1).join(' '))
    }

    const weightMatch = tail.match(/(\d+(?:\.\d+)?)(?:斤|公斤|千克|kg|KG)/i)
    const priceMatch = tail.match(/(?:每件|每个|单价|价格|价|每斤)?(\d+(?:\.\d+)?)(?:元|块钱|块)/)
    const commissionMatch = tail.match(/佣金(\d+(?:\.\d+)?)(?:元|块钱|块)?/)

    return {
      rawGoodsName: normalizeGoodsName(rawGoodsName),
      quantity: token.quantity,
      weight: weightMatch ? Number(weightMatch[1]) : null,
      price: priceMatch ? Number(priceMatch[1]) : null,
      commission: commissionMatch ? Number(commissionMatch[1]) : null
    }
  }).filter(item => item.rawGoodsName)

  return { customerName: inferredCustomerName, items }
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function cleanStructuredName(value: unknown) {
  return normalizeText(String(value || '')).slice(0, 50)
}

function structuredItemsToParsed(plan: AiStructuredIntent, fallbackCustomerName = ''): ParsedDraft {
  const items = Array.isArray(plan.items) ? plan.items : []
  return {
    customerName: cleanStructuredName(plan.customerName || plan.target?.customerName || fallbackCustomerName),
    items: items.map((item) => {
      const rawGoodsName = cleanStructuredName(item.goodsName || item.name)
      return {
        rawGoodsName: normalizeGoodsName(rawGoodsName),
        quantity: toOptionalNumber(item.quantity) || 0,
        weight: toOptionalNumber(item.weight),
        price: toOptionalNumber(item.price),
        commission: toOptionalNumber(item.commission)
      }
    }).filter(item => item.rawGoodsName && item.quantity > 0)
  }
}

function pendingDraftItemsToDraftItems(pendingDraft?: PendingDraftContext | null): DraftItem[] {
  if (!pendingDraft || !Array.isArray(pendingDraft.items)) return []
  return pendingDraft.items.map((item) => {
    const quantity = Number(item.quantity || 0)
    const weight = item.weight === null || item.weight === undefined ? null : Number(item.weight || 0)
    const price = Number(item.price || 0)
    const commission = Number(item.commission || 0)
    const unitType = item.unitType === 'weight' ? 'weight' : 'qty'
    const subtotal = unitType === 'weight' && Number(weight || 0) > 0
      ? Number((Number(weight || 0) * price + quantity * commission).toFixed(2))
      : Number((quantity * price + quantity * commission).toFixed(2))
    return {
      goodsId: Number(item.goodsId || 0),
      goodsName: String(item.goodsName || ''),
      unitType,
      quantity,
      weight: unitType === 'weight' ? Number(weight || 0) : null,
      price,
      commission,
      subtotal
    }
  }).filter(item => item.goodsId > 0 && item.goodsName && item.quantity > 0 && item.price > 0)
}

function buildTable(title: string, columns: string[], rows: string[][]): AiTable {
  return { title, columns, rows }
}

function buildTableAction(kind: QueryTableAction['kind'], title: string, summary: string, columns: string[], rows: string[][]): QueryTableAction {
  return {
    kind,
    title,
    summary,
    table: buildTable(title, columns, rows)
  }
}

function buildQueryAction(orders: Array<{
  id: number
  orderNo: string
  customerName: string
  status: string
  totalAmount: unknown
  commission: unknown
  profitAmount: unknown
  createdAt: Date
}>, title: string, summary: string): QueryOrdersAction {
  return {
    kind: 'query_orders',
    title,
    summary,
    orders: orders.map(order => ({
      id: order.id,
      orderNo: order.orderNo,
      customerName: order.customerName,
      status: order.status,
      totalAmount: Number(order.totalAmount || 0)
    })),
    table: buildTable(title, ['客户', '状态', '时间', '金额', '佣金', '利润'], orders.map(order => [
      order.customerName,
      statusText(order.status),
      formatOrderTime(order.createdAt),
      `￥${formatDecimal(order.totalAmount)}`,
      `￥${formatDecimal(order.commission)}`,
      `￥${formatDecimal(order.profitAmount)}`
    ]))
  }
}

function calculateDraftTotal(items: DraftItem[]) {
  const goodsAmount = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
  const commission = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.commission || 0), 0)
  return {
    goodsAmount: Number(goodsAmount.toFixed(2)),
    commission: Number(commission.toFixed(2))
  }
}

function buildDraftRows(items: DraftItem[]) {
  return items.map(item => [
    item.goodsName,
    `${formatDecimal(item.quantity)}`,
    item.weight ? `${formatDecimal(item.weight)}斤` : '-',
    `￥${formatDecimal(item.price)}`,
    `￥${formatDecimal(item.commission)}`,
    `￥${formatDecimal(item.subtotal)}`
  ])
}

function buildCreateAction(payload: DraftPayload, customerName: string, items: DraftItem[], title: string, summary: string): CreateOrderAction {
  const { goodsAmount, commission } = calculateDraftTotal(items)

  return {
    kind: 'create_order',
    title,
    summary,
    token: signDraft(payload),
    draft: {
      customerName,
      items
    },
    table: buildTable(title, ['商品', '件数', '重量', '单价', '佣金', '小计'], buildDraftRows(items)),
    totalAmount: goodsAmount,
    goodsAmount,
    commission,
    rowCount: items.length
  }
}

function buildAppendAction(payload: DraftPayload, order: OrderWithItems, items: DraftItem[], title: string, summary: string): AppendOrderAction {
  const { goodsAmount, commission } = calculateDraftTotal(items)

  return {
    kind: 'create_order',
    operation: 'append_order',
    title,
    summary,
    token: signDraft(payload),
    targetOrder: {
      id: order.id,
      orderNo: order.orderNo,
      customerName: order.customerName,
      totalAmount: Number(order.totalAmount || 0)
    },
    draft: {
      customerName: order.customerName,
      items
    },
    table: buildTable(title, ['商品', '件数', '重量', '单价', '佣金', '小计'], buildDraftRows(items)),
    totalAmount: goodsAmount,
    goodsAmount,
    commission,
    rowCount: items.length
  }
}

function goodsMutationOperationText(operation: GoodsMutationOperation) {
  const map: Record<GoodsMutationOperation, string> = {
    delete: '删除商品',
    clear: '库存清零',
    increase: '入库',
    set: '设置库存',
    create: '新增商品'
  }
  return map[operation] || '库存操作'
}

function buildGoodsMutationAction(payload: DraftPayload, mutation: GoodsMutationDraft): GoodsMutationAction {
  const operationText = goodsMutationOperationText(mutation.operation)
  const quantityText = mutation.quantity === null || mutation.quantity === undefined ? '-' : formatDecimal(mutation.quantity)
  const unitText = mutation.unitType === 'weight' ? '称重' : '计件'
  const summary = mutation.operation === 'delete'
    ? `请确认是否删除库存商品“${mutation.goodsName}”，确认前不会改动库存。`
    : mutation.operation === 'clear'
      ? `请确认是否把“${mutation.goodsName}”库存清零，确认前不会改动库存。`
      : mutation.operation === 'set'
        ? `请确认是否把“${mutation.goodsName}”库存设置为 ${quantityText}，确认前不会改动库存。`
        : mutation.operation === 'create'
          ? `请确认是否新增库存商品“${mutation.goodsName}”并入库 ${quantityText}，确认前不会改动库存。`
          : `请确认是否给“${mutation.goodsName}”入库 ${quantityText}，确认前不会改动库存。`

  return {
    kind: 'goods_mutation',
    title: operationText,
    summary,
    token: signDraft(payload),
    mutation,
    table: buildTable(operationText, ['操作', '商品', '数量', '类型', '售价', '成本佣金', '售卖佣金', '成本'], [[
      operationText,
      mutation.goodsName,
      quantityText,
      unitText,
      mutation.salePrice === null || mutation.salePrice === undefined ? '-' : `￥${formatDecimal(mutation.salePrice)}`,
      mutation.defaultCommission === null || mutation.defaultCommission === undefined ? '-' : `￥${formatDecimal(mutation.defaultCommission)}`,
      mutation.saleCommission === null || mutation.saleCommission === undefined ? '-' : `￥${formatDecimal(mutation.saleCommission)}`,
      mutation.costPrice === null || mutation.costPrice === undefined ? '-' : `￥${formatDecimal(mutation.costPrice)}`
    ]])
  }
}

function buildSupplierEntryAction(payload: DraftPayload, draft: SupplierEntryDraft): CreateSupplierEntryAction {
  const summary = `已生成入账草稿：货主 ${draft.supplierName}，${draft.goodsName} ${formatDecimal(draft.quantity)}件，${draft.unitType === 'weight' ? `${formatDecimal(draft.weight || 0)}斤，` : ''}总金额 ￥${formatDecimal(draft.totalAmount)}，拿货佣金 ￥${formatDecimal(draft.totalCommission)}。确认后会自动入库并记录欠款。`
  return {
    kind: 'create_supplier_entry',
    title: `${draft.supplierName}入账草稿`,
    summary,
    token: signDraft(payload),
    draft,
    table: buildTable('入账草稿', ['货主', '品名', '计费', '件数', '重量', '总金额', '拿货佣金', '售卖佣金', '成本', '售价'], [[
      draft.supplierName,
      draft.goodsName,
      draft.unitType === 'weight' ? '按斤' : '按件',
      formatDecimal(draft.quantity),
      draft.weight ? `${formatDecimal(draft.weight)}斤` : '-',
      `￥${formatDecimal(draft.totalAmount)}`,
      `￥${formatDecimal(draft.totalCommission)}`,
      `￥${formatDecimal(draft.saleCommission)}`,
      `￥${formatDecimal(draft.costPrice)}`,
      `￥${formatDecimal(draft.salePrice)}`
    ]])
  }
}

function extractContextFromText(content: string): AiConversationContext {
  const compact = normalizeCompact(content)
  const orderNo = compact.match(/DD\d{10,}/i)?.[0]

  const patterns = [
    /(?:客户|给|查到|已生成出单草稿：客户|已识别为给)\s*([\u4e00-\u9fa5A-Za-z0-9]{1,20})/,
    /“([^”]{1,20})”/,
    /([\u4e00-\u9fa5A-Za-z0-9]{1,20})(?:出单草稿|加单草稿|全部订单|今天订单|订单)/
  ]
  for (const pattern of patterns) {
    const match = content.match(pattern)
    const customerName = match?.[1] ? isMeaningfulCustomerName(match[1]) : ''
    if (customerName) return { customerName, orderNo }
  }

  return { orderNo }
}

function parseContextMessages(messages: AiContextMessage[]) {
  const orderedMessages = messages.slice(-12).reverse()
  for (const message of orderedMessages) {
    const parsed = extractContextFromText(String(message?.content || ''))
    if (parsed.customerName || parsed.orderNo) return parsed
  }
  return {}
}

function isSimpleCustomerNameReply(content: string) {
  const normalized = normalizeCompact(content)
  if (!normalized || normalized.length > 20) return ''
  if (/\d/.test(normalized)) return ''
  if (new RegExp(`(${QUERY_WORDS}|${CREATE_WORDS}|${APPEND_WORDS}|${ORDER_WORDS}|${INVENTORY_WORDS}|${DEBT_WORDS}|${PROFIT_WORDS}|${SUPPLIER_WORDS}|${SUPPLIER_ENTRY_WORDS})`).test(normalized)) return ''
  return isMeaningfulCustomerName(content)
}

function findPendingCreateFromMessages(messages?: AiContextMessage[], currentContent = ''): ParsedDraft | null {
  if (!Array.isArray(messages) || !messages.length) return null
  const currentCompact = normalizeCompact(currentContent)
  const orderedMessages = messages.slice(-10)

  for (let index = orderedMessages.length - 1; index >= 0; index -= 1) {
    const message = orderedMessages[index]
    if (message?.role !== 'user') continue

    const text = String(message.content || '')
    if (currentCompact && normalizeCompact(text) === currentCompact) continue

    const parsed = extractCreateSegments(text)
    if (parsed.items.length && !parsed.customerName) return parsed
  }

  return null
}

async function getConversationContext(staffId: number, context?: AiDataContext): Promise<AiConversationContext> {
  const messages = Array.isArray(context?.messages) ? context.messages.slice(-12).reverse() : []
  const fromClient = parseContextMessages(messages)
  if (fromClient.customerName || fromClient.orderNo) return fromClient

  const rows = await prisma.$queryRaw<Array<{ role: string, content: string }>>`
    SELECT role, content
    FROM ai_chat_messages
    WHERE staff_id = ${staffId}
    ORDER BY id DESC
    LIMIT 12
  `
  // 跳过当前刚保存的用户消息，避免“加单榴莲”这类句子被当成客户上下文。
  const fromDb = parseContextMessages(rows.slice(1))
  if (fromDb.customerName || fromDb.orderNo) {
    return fromDb
  }
  return {}
}

async function buildOrderQueryResult(customerName: string, range: ReturnType<typeof getDateRange>, status = ''): Promise<AiDataResult> {
  const createdAt = dateWhere(range)
  const where = {
    ...(customerName ? { customerName: { contains: customerName } } : {}),
    ...(status ? { status } : {}),
    ...(createdAt ? { createdAt } : {})
  }
  const [totalCount, aggregate, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({
      where: {
        ...where,
        status: { not: 'cancelled' }
      },
      _sum: {
        totalAmount: true,
        commission: true,
        profitAmount: true
      },
      _count: true
    }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: range.label === '全部' ? QUERY_TAKE_ALL : QUERY_TAKE_DEFAULT
    })
  ])

  const effectiveCount = aggregate._count
  const totalAmount = Number(aggregate._sum.totalAmount || 0)
  const commissionAmount = Number(aggregate._sum.commission || 0)
  const profitAmount = Number(aggregate._sum.profitAmount || 0)
  const paidAggregate = await prisma.order.aggregate({
    where: {
      ...where,
      status: 'paid'
    },
    _sum: { totalAmount: true }
  })
  const paidAmount = Number(paidAggregate._sum.totalAmount || 0)
  const unpaidAmount = Math.max(totalAmount - paidAmount, 0)

  const statusLabel = status === 'paid' ? '已付' : status === 'unpaid' ? '未付' : status === 'cancelled' ? '已毁单' : ''
  const subject = `${customerName ? `“${customerName}”` : '全部客户'}${statusLabel}`
  if (!orders.length) {
    const summary = `没有查到${subject}${range.label}的订单。`
    return {
      handled: true,
      answer: summary,
      action: buildQueryAction([], `${subject}${range.label}订单`, summary)
    }
  }

  const limitedText = totalCount > orders.length
    ? `本次只显示最近 ${orders.length} 笔，完整列表请到订单页筛选查看。`
    : ''
  const summary = [
    `查到${subject}${range.label}订单 ${totalCount} 笔，其中有效订单 ${effectiveCount} 笔。`,
    `合计 ￥${formatDecimal(totalAmount)}，已付 ￥${formatDecimal(paidAmount)}，未付 ￥${formatDecimal(unpaidAmount)}，佣金 ￥${formatDecimal(commissionAmount)}，利润 ￥${formatDecimal(profitAmount)}。`,
    limitedText
  ].filter(Boolean).join('')

  return {
    handled: true,
    answer: summary,
    action: buildQueryAction(orders, `${subject}${range.label}订单`, summary)
  }
}

async function answerOrderQuestion(content: string): Promise<AiDataResult> {
  if (!isOrderQuery(content)) {
    return { handled: false }
  }

  const customerName = extractQueryCustomerName(content)
  return buildOrderQueryResult(customerName, getDateRange(content), normalizeOrderStatus(content))
}

async function answerInventoryQuestion(content: string): Promise<AiDataResult> {
  if (!isInventoryQuery(content)) return { handled: false }
  return answerGoodsQuestion({
    intent: 'query_goods',
    goodsName: extractGoodsQueryName(content),
    zeroStock: /(零库存|没货|无货|缺货)/.test(normalizeCompact(content)),
    lowStock: /(低库存|快没|不多|少于|不足)/.test(normalizeCompact(content))
  }, content)
}

async function answerDebtQuestionByText(content: string): Promise<AiDataResult> {
  if (!isDebtQuery(content)) return { handled: false }
  return answerDebtQuestion({
    intent: 'query_debts',
    customerName: extractQueryCustomerName(content)
  })
}

async function answerProfitQuestionByText(content: string): Promise<AiDataResult> {
  if (!isProfitQuery(content)) return { handled: false }
  return answerProfitQuestion({
    intent: 'query_profit',
    dateRange: getDateRange(content).label === '全部' ? 'all' : 'unspecified'
  }, content)
}

async function answerSupermarketOrderQuestionByText(content: string): Promise<AiDataResult> {
  if (!isSupermarketOrderQuery(content)) return { handled: false }
  return answerSupermarketOrderQuestion({
    intent: 'query_supermarket_orders',
    supermarketName: extractSupermarketName(content),
    status: normalizeSupermarketStatus(content)
  }, content)
}

async function answerCustomerQuestion(plan: AiStructuredIntent): Promise<AiDataResult> {
  const customerName = cleanStructuredName(plan.customerName)
  if (!customerName) {
    return { handled: true, answer: '请告诉我要查询的客户名称。' }
  }

  const customers = await prisma.customer.findMany({
    where: { name: { contains: customerName } },
    orderBy: { id: 'desc' },
    take: 20
  })
  if (!customers.length) {
    return { handled: true, answer: `没有找到客户“${customerName}”。` }
  }

  const names = customers.map(customer => customer.name).join('、')
  const limitedText = customers.length >= 20 ? '，本次最多显示 20 个匹配客户' : ''
  return { handled: true, answer: `找到 ${customers.length} 个匹配客户：${names}${limitedText}。` }
}

async function answerGoodsQuestion(plan: AiStructuredIntent, content: string): Promise<AiDataResult> {
  const goodsName = cleanStructuredName(plan.goodsName || plan.items?.[0]?.goodsName || plan.items?.[0]?.name)
  const take = limitedTake(plan.limit, 20, 50)
  const zeroStock = Boolean(plan.zeroStock) || /(零库存|没货|无货|缺货)/.test(normalizeCompact(content))
  const lowStock = Boolean(plan.lowStock) || /(低库存|快没|不多|少于|不足)/.test(normalizeCompact(content))
  const stockWhere = zeroStock
    ? { lte: 0 }
    : lowStock
      ? { lte: 5 }
      : undefined
  const where = {
    enabled: true,
    ...(goodsName ? { name: { contains: goodsName } } : {}),
    ...(stockWhere ? { stock: stockWhere } : {})
  }
  const [total, goods] = await Promise.all([
    prisma.goods.count({ where }),
    prisma.goods.findMany({
      where,
      orderBy: zeroStock || lowStock ? [{ stock: 'asc' }, { updatedAt: 'desc' }] : [{ stock: 'desc' }, { updatedAt: 'desc' }],
      take
    })
  ])
  const subject = goodsName ? `“${goodsName}”` : zeroStock ? '零库存商品' : lowStock ? '低库存商品' : '库存商品'
  if (!goods.length) {
    const summary = `没有查到${subject}。`
    return {
      handled: true,
      answer: summary,
      action: buildTableAction('query_goods', `${subject}库存`, summary, ['商品', '类型', '库存', '售价', '默认佣金', '成本'], [])
    }
  }
  const limitedText = total > goods.length ? `本次只显示 ${goods.length} 条。` : ''
  const summary = `查到${subject} ${total} 条，${limitedText}`
  return {
    handled: true,
    answer: summary,
    action: buildTableAction('query_goods', `${subject}库存`, summary, ['商品', '类型', '库存', '售价', '默认佣金', '成本'], goods.map(item => [
      item.name,
      item.unitType === 'weight' ? '称重' : '计件',
      formatDecimal(item.stock),
      `￥${formatDecimal(item.salePrice)}`,
      `￥${formatDecimal(item.defaultCommission)}`,
      `￥${formatDecimal(item.costPrice)}`
    ]))
  }
}

async function findSingleGoodsForMutation(goodsName: string) {
  if (!goodsName) {
    return { error: '请告诉我要操作哪个库存商品，例如“删除蓝莓库存”或“蓝莓入库20件”。' }
  }

  const exact = await prisma.goods.findMany({
    where: { enabled: true, name: goodsName },
    orderBy: { updatedAt: 'desc' },
    take: 2
  })
  if (exact.length === 1) return { goods: exact[0] }

  const matched = await prisma.goods.findMany({
    where: { enabled: true, name: { contains: goodsName } },
    orderBy: [{ stock: 'desc' }, { updatedAt: 'desc' }],
    take: 6
  })
  if (matched.length === 1) return { goods: matched[0] }
  if (!matched.length) return { error: `没有找到“${goodsName}”库存。`, notFound: true }

  const rows = matched.map(item => [
    item.name,
    item.unitType === 'weight' ? '称重' : '计件',
    formatDecimal(item.stock),
    `￥${formatDecimal(item.salePrice)}`,
    `￥${formatDecimal(item.defaultCommission)}`,
    `￥${formatDecimal(item.costPrice)}`
  ])
  const summary = `找到多个包含“${goodsName}”的库存，先不操作。请说完整品名。`
  return {
    error: summary,
    action: buildTableAction('query_goods', `“${goodsName}”库存候选`, summary, ['商品', '类型', '库存', '售价', '默认佣金', '成本'], rows)
  }
}

async function answerInventoryMutationQuestion(content: string, staffId: number): Promise<AiDataResult> {
  if (!isInventoryMutation(content)) return { handled: false }
  if (!staffId) return { handled: true, answer: '请先登录后再操作库存。' }

  const parsed = extractInventoryMutation(content)
  if (!parsed.operation) return { handled: true, answer: '请说明要删除、清零、入库还是设置库存。' }

  if ((parsed.operation === 'increase' || parsed.operation === 'set') && (!parsed.quantity || parsed.quantity <= 0)) {
    return { handled: true, answer: `请告诉“${parsed.goodsName || '这个商品'}”要${parsed.operation === 'set' ? '设置为' : '增加'}多少库存。` }
  }

  const target = await findSingleGoodsForMutation(parsed.goodsName)
  if ('error' in target) {
    if (target.notFound && parsed.operation === 'increase' && parsed.goodsName) {
      const mutation: GoodsMutationDraft = {
        operation: 'create',
        goodsName: parsed.goodsName,
        quantity: parsed.quantity || 0,
        unitType: parsed.unitType === 'weight' ? 'weight' : 'qty',
        salePrice: parsed.salePrice ?? parsed.costPrice ?? 0,
        costPrice: parsed.costPrice ?? parsed.salePrice ?? 0,
        defaultCommission: parsed.defaultCommission ?? 0
      }
      const action = buildGoodsMutationAction({
        kind: 'goods_mutation',
        staffId,
        expiresAt: new Date(Date.now() + AI_OPERATION_TTL_MS).toISOString(),
        goodsMutation: mutation
      }, mutation)
      return { handled: true, answer: action.summary, action }
    }
    return { handled: true, answer: target.error, action: target.action }
  }

  const goods = target.goods
  const mutation: GoodsMutationDraft = {
    operation: parsed.operation,
    goodsId: goods.id,
    goodsName: goods.name,
    quantity: parsed.quantity,
    unitType: parsed.unitType === 'weight' ? 'weight' : 'qty',
    salePrice: parsed.salePrice,
    costPrice: parsed.costPrice,
    defaultCommission: parsed.defaultCommission
  }
  const action = buildGoodsMutationAction({
    kind: 'goods_mutation',
    staffId,
    expiresAt: new Date(Date.now() + AI_OPERATION_TTL_MS).toISOString(),
    goodsMutation: mutation
  }, mutation)

  return { handled: true, answer: action.summary, action }
}

async function answerDebtQuestion(plan: AiStructuredIntent): Promise<AiDataResult> {
  const customerName = cleanStructuredName(plan.customerName)
  const take = limitedTake(plan.limit, 20, 50)
  const customerWhere = {
    name: {
      not: '客户',
      ...(customerName ? { contains: customerName } : {})
    }
  }
  const customers = await prisma.customer.findMany({
    where: customerWhere,
    select: { id: true, name: true, partialPayment: true },
    take: customerName ? 20 : 200,
    orderBy: { id: 'desc' }
  })
  const customerIds = customers.map(customer => customer.id)
  const debts = customerIds.length
    ? await prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, status: 'unpaid' },
      _sum: { totalAmount: true },
      _count: { _all: true }
    })
    : []
  const customerMap = new Map(customers.map(customer => [customer.id, customer]))
  const rows = debts.map((debt) => {
    const customer = customerMap.get(debt.customerId)
    const totalDebt = Number(debt._sum.totalAmount || 0)
    const partialPayment = Math.min(Number(customer?.partialPayment || 0), totalDebt)
    const unpaidAmount = Math.max(totalDebt - partialPayment, 0)
    return {
      customerName: customer?.name || '',
      orderCount: debt._count._all || 0,
      totalDebt,
      partialPayment,
      unpaidAmount
    }
  }).filter(row => row.unpaidAmount > 0 || customerName).sort((a, b) => b.unpaidAmount - a.unpaidAmount).slice(0, take)

  const subject = customerName ? `“${customerName}”` : '客户'
  if (!rows.length) {
    const summary = `没有查到${subject}未付欠款。`
    return {
      handled: true,
      answer: summary,
      action: buildTableAction('query_debts', `${subject}欠款`, summary, ['客户', '未付订单', '欠款', '已抵扣', '未收'], [])
    }
  }
  const unpaidTotal = rows.reduce((sum, row) => sum + row.unpaidAmount, 0)
  const summary = `查到${subject}欠款 ${rows.length} 条，未收合计 ￥${formatDecimal(unpaidTotal)}。`
  return {
    handled: true,
    answer: summary,
    action: buildTableAction('query_debts', `${subject}欠款`, summary, ['客户', '未付订单', '欠款', '已抵扣', '未收'], rows.map(row => [
      row.customerName,
      `${row.orderCount}`,
      `￥${formatDecimal(row.totalDebt)}`,
      `￥${formatDecimal(row.partialPayment)}`,
      `￥${formatDecimal(row.unpaidAmount)}`
    ]))
  }
}

async function answerSupplierDebtQuestion(plan: AiStructuredIntent, content = ''): Promise<AiDataResult> {
  const supplierName = cleanSupplierKeyword(cleanStructuredName(plan.supplierName || plan.customerName)) || extractSupplierName(content)
  const take = limitedTake(plan.limit, 20, 20)
  const suppliers = await prisma.supplier.findMany({
    where: supplierName ? { name: { contains: supplierName } } : {},
    select: { id: true, name: true, partialPayment: true },
    take: supplierName ? 20 : 500,
    orderBy: { id: 'desc' }
  })
  const supplierIds = suppliers.map(supplier => supplier.id)
  const debts = supplierIds.length
    ? await prisma.supplierEntry.groupBy({
      by: ['supplierId'],
      where: { supplierId: { in: supplierIds }, status: 'unpaid' },
      _sum: { totalAmount: true },
      _count: { _all: true }
    })
    : []
  const supplierMap = new Map(suppliers.map(supplier => [supplier.id, supplier]))
  const allRows = debts.map((debt) => {
    const supplier = supplierMap.get(debt.supplierId)
    const totalDebt = Number(debt._sum.totalAmount || 0)
    const partialPayment = Math.min(Number(supplier?.partialPayment || 0), totalDebt)
    const unpaidAmount = Math.max(totalDebt - partialPayment, 0)
    return {
      supplierName: supplier?.name || '',
      entryCount: debt._count._all || 0,
      totalDebt,
      partialPayment,
      unpaidAmount
    }
  }).filter(row => row.unpaidAmount > 0 || supplierName).sort((a, b) => b.unpaidAmount - a.unpaidAmount)

  const subject = supplierName ? `“${supplierName}”货主` : '货主'
  const totalUnpaid = allRows.reduce((sum, row) => sum + row.unpaidAmount, 0)
  const totalDebt = allRows.reduce((sum, row) => sum + row.totalDebt, 0)
  const totalPartialPayment = allRows.reduce((sum, row) => sum + row.partialPayment, 0)
  const rows = allRows.slice(0, take)
  if (!rows.length) {
    const summary = supplierName && suppliers.length
      ? `${subject}当前没有未付入账，欠款为 ￥0。`
      : `没有查到${subject}未付欠款。`
    return {
      handled: true,
      answer: summary,
      action: buildTableAction('query_supplier_debts', `${subject}欠款`, summary, ['货主', '未付入账', '欠款', '已抵扣', '未付'], [])
    }
  }

  const limitedText = allRows.length > rows.length ? `本次只显示前 ${rows.length} 个货主。` : ''
  const summary = supplierName
    ? `${subject}未付 ￥${formatDecimal(totalUnpaid)}，未付入账 ${rows.reduce((sum, row) => sum + row.entryCount, 0)} 笔。${limitedText}`
    : `总共欠货主们 ￥${formatDecimal(totalUnpaid)}，涉及 ${allRows.length} 个货主；入账欠款 ￥${formatDecimal(totalDebt)}，已抵扣 ￥${formatDecimal(totalPartialPayment)}。${limitedText}`

  return {
    handled: true,
    answer: summary,
    action: buildTableAction('query_supplier_debts', `${subject}欠款`, summary, ['货主', '未付入账', '欠款', '已抵扣', '未付'], rows.map(row => [
      row.supplierName,
      `${row.entryCount}`,
      `￥${formatDecimal(row.totalDebt)}`,
      `￥${formatDecimal(row.partialPayment)}`,
      `￥${formatDecimal(row.unpaidAmount)}`
    ]))
  }
}

function supplierEntryStatusText(status: string) {
  return status === 'paid' ? '已付清' : '未付'
}

function supplierEntryUnitText(entry: { unitType: string, quantity: unknown, weight?: unknown }) {
  const quantity = `${formatDecimal(entry.quantity)}件`
  if (entry.unitType === 'weight' && entry.weight) return `${quantity}/${formatDecimal(entry.weight)}斤`
  return quantity
}

async function answerSupplierEntryQuestion(plan: AiStructuredIntent, content: string): Promise<AiDataResult> {
  const structuredKeyword = cleanSupplierKeyword(cleanStructuredName(plan.goodsName || plan.supplierName || plan.customerName))
  const keyword = structuredKeyword || extractSupplierEntryKeyword(content)
  const status = normalizeSupplierEntryStatus(content) || normalizeSupplierEntryStatus(plan.status)
  const range = getDateRangeByKey(plan.dateRange, content)
  const createdAt = dateWhere(range)
  const take = limitedTake(plan.limit, 20, 20)
  const where = {
    ...(status ? { status } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(keyword ? {
      OR: [
        { supplierName: { contains: keyword } },
        { goodsName: { contains: keyword } }
      ]
    } : {})
  }
  const [total, aggregate, entries] = await Promise.all([
    prisma.supplierEntry.count({ where }),
    prisma.supplierEntry.aggregate({
      where,
      _sum: {
        totalAmount: true,
        totalCommission: true,
        quantity: true,
        weight: true
      }
    }),
    prisma.supplierEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take
    })
  ])

  const subject = `${keyword ? `“${keyword}”` : '全部'}${status === 'paid' ? '已付清' : status === 'unpaid' ? '未付' : ''}`
  if (!entries.length) {
    const summary = `没有查到${subject}${range.label}入账记录。`
    return {
      handled: true,
      answer: summary,
      action: buildTableAction('query_supplier_entries', `${subject}${range.label}入账记录`, summary, ['时间', '货主', '品名', '数量', '总金额', '佣金', '状态'], [])
    }
  }

  const limitedText = total > entries.length ? `本次只显示最近 ${entries.length} 条。` : ''
  const summary = [
    `查到${subject}${range.label}入账记录 ${total} 条。`,
    `总金额 ￥${formatDecimal(aggregate._sum.totalAmount || 0)}，总佣金 ￥${formatDecimal(aggregate._sum.totalCommission || 0)}，件数 ${formatDecimal(aggregate._sum.quantity || 0)}。`,
    aggregate._sum.weight ? `重量 ${formatDecimal(aggregate._sum.weight)}斤。` : '',
    limitedText
  ].filter(Boolean).join('')

  return {
    handled: true,
    answer: summary,
    action: buildTableAction('query_supplier_entries', `${subject}${range.label}入账记录`, summary, ['时间', '货主', '品名', '数量', '总金额', '佣金', '状态'], entries.map(entry => [
      formatOrderTime(entry.createdAt),
      entry.supplierName,
      entry.goodsName,
      supplierEntryUnitText(entry),
      `￥${formatDecimal(entry.totalAmount)}`,
      `￥${formatDecimal(entry.totalCommission)}`,
      supplierEntryStatusText(entry.status)
    ]))
  }
}

async function answerProfitQuestion(plan: AiStructuredIntent, content: string): Promise<AiDataResult> {
  const range = getDateRangeByKey(plan.dateRange, content)
  const createdAt = dateWhere(range)
  const dateWhereFilter = createdAt ? { createdAt } : {}
  const [orders, supermarketOrders] = await Promise.all([
    prisma.order.findMany({
      where: { ...dateWhereFilter, status: { not: 'cancelled' } },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.supermarketOrder.findMany({
      where: { ...dateWhereFilter, status: { not: 'cancelled' } },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    })
  ])
  const normalSales = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
  const normalProfit = orders.reduce((sum, order) => sum + Number(order.profitAmount || 0), 0)
  const supermarketSales = supermarketOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
  const supermarketProfit = supermarketOrders.reduce((sum, order) => sum + Number(order.totalProfit || 0), 0)
  const summary = `${range.label}利润：销售额 ￥${formatDecimal(normalSales + supermarketSales)}，利润 ￥${formatDecimal(normalProfit + supermarketProfit)}，订单 ${orders.length + supermarketOrders.length} 笔。`
  return {
    handled: true,
    answer: summary,
    action: buildTableAction('query_profit', `${range.label}利润`, summary, ['类型', '订单数', '销售额', '利润'], [
      ['普通订单', `${orders.length}`, `￥${formatDecimal(normalSales)}`, `￥${formatDecimal(normalProfit)}`],
      ['超市配送', `${supermarketOrders.length}`, `￥${formatDecimal(supermarketSales)}`, `￥${formatDecimal(supermarketProfit)}`],
      ['合计', `${orders.length + supermarketOrders.length}`, `￥${formatDecimal(normalSales + supermarketSales)}`, `￥${formatDecimal(normalProfit + supermarketProfit)}`]
    ])
  }
}

async function answerSupermarketOrderQuestion(plan: AiStructuredIntent, content: string): Promise<AiDataResult> {
  const supermarketName = cleanStructuredName(plan.supermarketName || plan.customerName)
  const status = normalizeSupermarketStatus(plan.status || content)
  const range = getDateRangeByKey(plan.dateRange, content)
  const createdAt = dateWhere(range)
  const take = limitedTake(plan.limit, 20, 50)
  const where = {
    ...(supermarketName ? { supermarketName: { contains: supermarketName } } : {}),
    ...(status ? { status } : {}),
    ...(createdAt ? { createdAt } : {})
  }
  const [total, orders] = await Promise.all([
    prisma.supermarketOrder.count({ where }),
    prisma.supermarketOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take
    })
  ])
  const subject = `${supermarketName ? `“${supermarketName}”` : '超市配送'}${status === 'active' ? '未付' : status === 'paid' ? '已付' : status === 'cancelled' ? '已取消' : ''}`
  if (!orders.length) {
    const summary = `没有查到${subject}${range.label}订单。`
    return {
      handled: true,
      answer: summary,
      action: buildTableAction('query_supermarket_orders', `${subject}${range.label}订单`, summary, ['订单号', '超市', '状态', '时间', '金额', '利润'], [])
    }
  }
  const limitedText = total > orders.length ? `本次只显示最近 ${orders.length} 笔。` : ''
  const summary = `查到${subject}${range.label}订单 ${total} 笔。${limitedText}`
  return {
    handled: true,
    answer: summary,
    action: buildTableAction('query_supermarket_orders', `${subject}${range.label}订单`, summary, ['订单号', '超市', '状态', '时间', '金额', '利润'], orders.map(order => [
      order.orderNo,
      order.supermarketName,
      order.status === 'active' ? '未付' : order.status === 'paid' ? '已付' : '已取消',
      formatOrderTime(order.createdAt),
      `￥${formatDecimal(order.totalAmount)}`,
      `￥${formatDecimal(order.totalProfit)}`
    ]))
  }
}

async function resolveGoods(rawName: string) {
  const exact = await prisma.goods.findFirst({
    where: { enabled: true, name: { equals: rawName } }
  })
  if (exact) return exact

  const matched = await prisma.goods.findMany({
    where: {
      enabled: true,
      name: { contains: rawName }
    },
    orderBy: [{ stock: 'desc' }, { updatedAt: 'desc' }],
    take: 5
  })
  return matched[0] || null
}

async function resolveDraftItems(parsed: ParsedDraft): Promise<DraftItem[] | string> {
  const resolvedItems: DraftItem[] = []

  for (const item of parsed.items) {
    const goods = await resolveGoods(item.rawGoodsName)
    if (!goods) {
      return `已识别到商品“${item.rawGoodsName}”，但系统里没有找到对应货物。`
    }

    const price = Number((item.price ?? Number(goods.salePrice || goods.costPrice || 0)).toFixed(2))
    const commission = Number((item.commission ?? Number(goods.saleCommission || 0)).toFixed(2))
    const weight = goods.unitType === 'weight' ? Number((item.weight ?? item.quantity).toFixed(2)) : null
    const subtotal = goods.unitType === 'weight'
      ? Number((((weight || 0) * price) + (item.quantity * commission)).toFixed(2))
      : Number(((item.quantity * price) + item.quantity * commission).toFixed(2))

    resolvedItems.push({
      goodsId: goods.id,
      goodsName: goods.name,
      unitType: goods.unitType,
      quantity: item.quantity,
      weight,
      price,
      commission,
      subtotal
    })
  }

  return resolvedItems
}

function wantsLatestOrder(content: string) {
  return /(今天|今日|刚才|刚刚|最近|最新|最后|上一单|上一个|刚那单|这单|当前订单|刚出的单)/.test(normalizeCompact(content))
}

async function findTargetOrder(content: string, customerName: string, staffId: number, context?: AiConversationContext) {
  const normalized = normalizeCompact(content)
  const orderNo = normalized.match(/DD\d{10,}/i)?.[0] || context?.orderNo
  if (orderNo) {
    return prisma.order.findFirst({
      where: { orderNo, status: { not: 'cancelled' } },
      include: { items: true }
    })
  }

  const effectiveCustomerName = customerName || context?.customerName || ''
  const range = wantsLatestOrder(content)
    ? getDateRange(content)
    : { label: '全部' }
  const createdAt = dateWhere(range)

  const candidates = await prisma.order.findMany({
    where: {
      status: { not: 'cancelled' },
      ...(effectiveCustomerName ? { customerName: { contains: effectiveCustomerName } } : { staffId }),
      ...(createdAt ? { createdAt } : {})
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 3
  })
  if (!candidates.length) return null
  if (orderNo || wantsLatestOrder(content) || candidates.length === 1) return candidates[0]

  return {
    ambiguous: true,
    customerName: effectiveCustomerName,
    candidates
  } as const
}

async function buildAppendOrderResult(content: string, staffId: number, parsed: ParsedDraft, context?: AiConversationContext, structuredTarget?: AiStructuredIntent['target']): Promise<AiDataResult> {
  if (!parsed.items.length) {
    return {
      handled: true,
      answer: '已识别为加单需求，但没有识别到要追加的商品。请补充商品名称、数量和价格。'
    }
  }

  const resolvedItems = await resolveDraftItems(parsed)
  if (typeof resolvedItems === 'string') {
    return { handled: true, answer: resolvedItems }
  }

  const targetContext = {
    ...context,
    ...(structuredTarget?.orderNo ? { orderNo: structuredTarget.orderNo } : {}),
    ...(structuredTarget?.customerName ? { customerName: structuredTarget.customerName } : {})
  }
  const targetText = structuredTarget?.latest ? `${content} 最新一单` : content
  const order = await findTargetOrder(targetText, parsed.customerName, staffId, targetContext)
  if (order && 'ambiguous' in order) {
    const nameText = order.customerName ? `${order.customerName} 有多笔订单` : '最近有多笔订单'
    const lines = order.candidates.map(item => `${item.orderNo}，${formatOrderTime(item.createdAt)}，￥${formatDecimal(item.totalAmount)}`).join('；')
    return {
      handled: true,
      answer: `${nameText}，我不确定要加到哪一单，先不操作。请带上订单号，或说“给${order.customerName || '这个客户'}最新一单加单”。候选：${lines}`
    }
  }
  if (!order) {
    const nameText = parsed.customerName || context?.customerName ? `客户 ${parsed.customerName || context?.customerName} 的` : ''
    return {
      handled: true,
      answer: `没有找到${nameText}可加单的原订单。你可以说“给老总最新一单加苹果2件”，或先查询订单后再指定订单号。`
    }
  }

  const addAmount = resolvedItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
  const expiresAt = new Date(Date.now() + AI_OPERATION_TTL_MS).toISOString()
  const draftPayload: DraftPayload = {
    kind: 'append_order',
    staffId,
    orderId: order.id,
    expiresAt
  }
  const summary = `已识别为给 ${order.customerName} 的订单 ${order.orderNo} 加单：新增 ${resolvedItems.length} 个商品，新增金额 ￥${formatDecimal(addAmount)}。确认后会追加到原订单并重算库存、金额和欠款。`

  return {
    handled: true,
    answer: summary,
    action: buildAppendAction(
      draftPayload,
      order,
      resolvedItems,
      `${order.customerName}加单草稿`,
      summary
    )
  }
}

async function buildPendingDraftAppendResult(content: string, staffId: number, parsed: ParsedDraft, pendingDraft: PendingDraftContext): Promise<AiDataResult> {
  const baseItems = pendingDraftItemsToDraftItems(pendingDraft)
  if (!baseItems.length) return { handled: false }

  const resolvedItems = await resolveDraftItems(parsed)
  if (typeof resolvedItems === 'string') {
    return { handled: true, answer: resolvedItems }
  }

  const items = [...baseItems, ...resolvedItems]
  const customerName = cleanStructuredName(pendingDraft.customerName) || parsed.customerName || '客户'
  const expiresAt = new Date(Date.now() + AI_OPERATION_TTL_MS).toISOString()
  const operation = pendingDraft.operation === 'append_order' ? 'append_order' : 'create_order'
  const draftPayload: DraftPayload = {
    kind: operation,
    staffId,
    ...(operation === 'append_order' && pendingDraft.targetOrder?.id ? { orderId: Number(pendingDraft.targetOrder.id) } : {}),
    expiresAt
  }
  const addAmount = resolvedItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
  const totalAmount = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
  const summary = `已把新增商品加入当前未确认草稿：新增 ${resolvedItems.length} 项，新增金额 ￥${formatDecimal(addAmount)}，草稿合计 ￥${formatDecimal(totalAmount)}。确认后才会正式出单。`
  if (operation === 'append_order' && pendingDraft.targetOrder?.id && pendingDraft.targetOrder?.orderNo) {
    const order = {
      id: Number(pendingDraft.targetOrder.id),
      orderNo: String(pendingDraft.targetOrder.orderNo),
      customerName,
      totalAmount: Number(pendingDraft.targetOrder.totalAmount || 0),
      items: []
    } as unknown as OrderWithItems
    return {
      handled: true,
      answer: summary,
      action: buildAppendAction(draftPayload, order, items, `${customerName}加单草稿`, summary)
    }
  }

  return {
    handled: true,
    answer: summary,
    action: buildCreateAction(draftPayload, customerName, items, `${customerName}出单草稿`, summary)
  }
}

async function answerAppendOrderQuestion(content: string, staffId: number, context?: AiConversationContext): Promise<AiDataResult> {
  if (!isAppendIntent(content)) {
    return { handled: false }
  }

  return buildAppendOrderResult(content, staffId, extractCreateSegments(content), context)
}

async function buildCreateOrderResult(staffId: number, parsed: ParsedDraft, context?: AiConversationContext): Promise<AiDataResult> {
  if (!parsed.items.length) {
    return {
      handled: true,
      answer: '已识别为出单需求，但没有识别到商品明细。请补充商品名称、数量和价格。'
    }
  }

  const customerName = parsed.customerName || context?.customerName || '客户'
  const resolvedItems = await resolveDraftItems(parsed)
  if (typeof resolvedItems === 'string') {
    return { handled: true, answer: resolvedItems }
  }

  const goodsAmount = resolvedItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
  const expiresAt = new Date(Date.now() + AI_OPERATION_TTL_MS).toISOString()
  const draftPayload: DraftPayload = {
    kind: 'create_order',
    staffId,
    expiresAt
  }

  const summary = `已生成出单草稿：客户 ${customerName}，共 ${resolvedItems.length} 个商品，合计 ￥${formatDecimal(goodsAmount)}。确认后将正式出单。`
  return {
    handled: true,
    answer: summary,
    action: buildCreateAction(
      draftPayload,
      customerName,
      resolvedItems,
      `${customerName}出单草稿`,
      summary
    )
  }
}

async function answerCreateOrderQuestion(content: string, staffId: number, context?: AiConversationContext): Promise<AiDataResult> {
  if (!isCreateIntent(content)) {
    return { handled: false }
  }

  return buildCreateOrderResult(staffId, extractCreateSegments(content), context)
}

async function answerCreateSupplierEntryQuestion(content: string, staffId: number): Promise<AiDataResult> {
  if (!isSupplierEntryCreateIntent(content)) return { handled: false }
  if (!staffId) return { handled: true, answer: '请先登录后再入账。' }

  const draft = extractSupplierEntryDraft(content)
  if (typeof draft === 'string') return { handled: true, answer: draft }
  const payload: DraftPayload = {
    kind: 'create_supplier_entry',
    staffId,
    expiresAt: new Date(Date.now() + AI_OPERATION_TTL_MS).toISOString(),
    supplierEntry: draft
  }
  const action = buildSupplierEntryAction(payload, draft)
  return { handled: true, answer: action.summary, action }
}

async function answerStructuredAiDataQuestion(content: string, staffId: number, plan: AiStructuredIntent, context?: AiConversationContext, pendingDraft?: PendingDraftContext | null): Promise<AiDataResult> {
  if (!plan || plan.intent === 'chat' || plan.intent === 'unknown') return { handled: false }
  if (plan.needsClarification) {
    return {
      handled: true,
      answer: cleanStructuredName(plan.clarification) || '这条指令还缺少必要信息，请补充后我再操作。'
    }
  }

  if (plan.intent === 'query_customer') return answerCustomerQuestion(plan)
  if (plan.intent === 'query_goods') return answerGoodsQuestion(plan, content)
  if (plan.intent === 'query_debts') return answerDebtQuestion(plan)
  if (plan.intent === 'query_supplier_debts') return answerSupplierDebtQuestion(plan, content)
  if (plan.intent === 'query_supplier_entries') return answerSupplierEntryQuestion(plan, content)
  if (plan.intent === 'create_supplier_entry') return answerCreateSupplierEntryQuestion(content, staffId)
  if (plan.intent === 'query_profit') return answerProfitQuestion(plan, content)
  if (plan.intent === 'query_supermarket_orders') return answerSupermarketOrderQuestion(plan, content)

  if (plan.intent === 'query_orders') {
    const customerName = isMeaningfulCustomerName(String(plan.customerName || ''))
    const range = getDateRangeByKey(plan.dateRange, content)
    return buildOrderQueryResult(customerName, range, normalizeOrderStatus(plan.status || content))
  }

  if (plan.intent === 'append_order') {
    const parsed = structuredItemsToParsed(plan, context?.customerName || '')
    if (pendingDraft?.items?.length && !plan.orderNo && !plan.target?.orderNo) {
      return buildPendingDraftAppendResult(content, staffId, parsed, pendingDraft)
    }
    const orderNo = cleanStructuredName(plan.orderNo)
    const target = {
      ...plan.target,
      ...(orderNo ? { orderNo } : {})
    }
    return buildAppendOrderResult(content, staffId, parsed, context, target)
  }

  if (plan.intent === 'create_order') {
    const parsed = structuredItemsToParsed(plan, context?.customerName || '')
    if (!parsed.customerName && !context?.customerName) {
      return { handled: true, answer: '这单是哪个客户的？请补充客户名，例如“陈老 蓝莓20件50元”。' }
    }
    return buildCreateOrderResult(staffId, parsed, context)
  }

  return { handled: false }
}

export async function answerAiDataQuestion(content: string, staffId = 0, dataContext?: AiDataContext): Promise<AiDataResult> {
  let conversationContext: AiConversationContext | null = null
  const ensureConversationContext = async () => {
    if (!conversationContext) {
      conversationContext = await getConversationContext(staffId, dataContext)
    }
    return conversationContext
  }

  const customerReply = isSimpleCustomerNameReply(content)
  if (customerReply) {
    const pendingCreate = findPendingCreateFromMessages(dataContext?.messages, content)
    if (pendingCreate?.items.length) {
      return buildCreateOrderResult(staffId, {
        ...pendingCreate,
        customerName: customerReply
      })
    }
  }

  const inventoryMutationResult = await answerInventoryMutationQuestion(content, staffId)
  if (inventoryMutationResult.handled) return inventoryMutationResult

  const createSupplierEntryResult = await answerCreateSupplierEntryQuestion(content, staffId)
  if (createSupplierEntryResult.handled) return createSupplierEntryResult

  if (dataContext?.structuredIntent) {
    if (isSupplierEntryQuery(content)) {
      const supplierEntryResult = await answerSupplierEntryQuestion(dataContext.structuredIntent, content)
      if (supplierEntryResult.handled) return supplierEntryResult
    }
    if (isSupplierDebtQuery(content)) {
      const supplierDebtResult = await answerSupplierDebtQuestion(dataContext.structuredIntent, content)
      if (supplierDebtResult.handled) return supplierDebtResult
    }

    const needsContext = dataContext.structuredIntent.intent === 'append_order' || dataContext.structuredIntent.intent === 'create_order'
    const context = needsContext ? await ensureConversationContext() : {}
    const structuredResult = await answerStructuredAiDataQuestion(content, staffId, dataContext.structuredIntent, context, dataContext.pendingDraft)
    if (structuredResult.handled) return structuredResult
  }

  if (dataContext?.pendingDraft?.items?.length && isAppendIntent(content)) {
    const pendingAppendResult = await buildPendingDraftAppendResult(content, staffId, extractCreateSegments(content), dataContext.pendingDraft)
    if (pendingAppendResult.handled) return pendingAppendResult
  }

  let intentPlan = analyzeAiIntent(content)
  if (intentPlan.action === 'append' && !intentPlan.sqlReady) {
    const context = await ensureConversationContext()
    intentPlan = analyzeAiIntent(content, context)
  }
  if (intentPlan.action === 'create' && !intentPlan.sqlReady) {
    const context = await ensureConversationContext()
    intentPlan = analyzeAiIntent(content, context)
  }
  if (intentPlan.action !== 'chat' && !intentPlan.sqlReady) {
    return {
      handled: true,
      answer: intentPlan.questionToUser || '这条指令还缺少必要信息，请补充后我再操作。'
    }
  }

  const inventoryResult = await answerInventoryQuestion(content)
  if (inventoryResult.handled) return inventoryResult

  if (isSupplierEntryQuery(content)) {
    const supplierEntryResult = await answerSupplierEntryQuestion({ intent: 'query_supplier_entries' }, content)
    if (supplierEntryResult.handled) return supplierEntryResult
  }

  if (isSupplierDebtQuery(content)) {
    const supplierDebtResult = await answerSupplierDebtQuestion({ intent: 'query_supplier_debts' }, content)
    if (supplierDebtResult.handled) return supplierDebtResult
  }

  const debtResult = await answerDebtQuestionByText(content)
  if (debtResult.handled) return debtResult

  const profitResult = await answerProfitQuestionByText(content)
  if (profitResult.handled) return profitResult

  const supermarketOrderResult = await answerSupermarketOrderQuestionByText(content)
  if (supermarketOrderResult.handled) return supermarketOrderResult

  const queryResult = await answerOrderQuestion(content)
  if (queryResult.handled) return queryResult

  if (isAppendIntent(content)) {
    const appendResult = await answerAppendOrderQuestion(content, staffId, await ensureConversationContext())
    if (appendResult.handled) return appendResult
  }

  const createResult = await answerCreateOrderQuestion(content, staffId, conversationContext || undefined)
  if (createResult.handled) return createResult

  return { handled: false }
}

function normalizeEditableItems(rawItems: unknown) {
  if (!Array.isArray(rawItems)) {
    throw createError({ statusCode: 400, statusMessage: '请至少保留一个商品' })
  }
  return rawItems.map((item: any) => ({
    goodsId: Number(item?.goodsId || 0),
    quantity: Number(item?.quantity || 0),
    weight: item?.weight === null || item?.weight === undefined || item?.weight === '' ? 0 : Number(item.weight),
    price: Number(item?.price || 0),
    commission: Number(item?.commission || 0)
  }))
}

async function createOrderFromDraft(staffId: number, editable?: { customerName?: string, customerId?: number, items?: unknown }) {
  return prisma.$transaction(async (tx) => {
    const customerId = Number(editable?.customerId || 0)
    const customerName = String(editable?.customerName || '').trim() || '客户'
    const customer = customerId > 0
      ? await tx.customer.findUnique({ where: { id: customerId } })
      : await tx.customer.upsert({
        where: { name: customerName },
        update: {},
        create: { name: customerName }
      })
    if (!customer) {
      throw createError({ statusCode: 400, statusMessage: '客户不存在' })
    }
    const staff = await tx.staffUser.findUnique({
      where: { id: staffId },
      select: { name: true }
    })
    if (!staff) {
      throw createError({ statusCode: 404, statusMessage: '店员不存在' })
    }

    const items = await buildOrderItems(tx, normalizeEditableItems(editable?.items))
    await deductStock(tx, items)

    const goodsAmount = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
    const commission = Number(items.reduce((sum, item) => sum + item.quantity * item.commission, 0).toFixed(2))
    const profitAmount = Number(items.reduce((sum, item) => sum + item.profit, 0).toFixed(2))

    const order = await tx.order.create({
      data: {
        orderNo: createOrderNo(),
        customerId: customer.id,
        customerName: customer.name,
        staffId,
        staffName: staff.name,
        goodsAmount,
        commission,
        totalAmount: goodsAmount,
        profitAmount,
        items: { create: items.map(mapOrderItem) }
      },
      include: { items: true }
    })

    await recalculateCustomerDebt(customer.id, tx)
    return order
  })
}

async function appendOrderFromDraft(orderId: number, editable?: { items?: unknown }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '订单不存在' })
    }
    if (order.status === 'cancelled') {
      throw createError({ statusCode: 400, statusMessage: '已毁单订单不能加单' })
    }

    await restoreStock(tx, order.items)
    const appendedItems = await buildOrderItems(tx, normalizeEditableItems(editable?.items))
    const mergedRawItems = [
      ...order.items.map(item => ({
        goodsId: item.goodsId,
        quantity: Number(item.quantity),
        weight: item.weight === null ? 0 : Number(item.weight),
        price: Number(item.price),
        commission: Number(item.commission)
      })),
      ...appendedItems.map(item => ({
        goodsId: item.goods.id,
        quantity: item.quantity,
        weight: item.weight || 0,
        price: item.price,
        commission: item.commission
      }))
    ]
    const mergedItems = await buildOrderItems(tx, mergedRawItems)
    await deductStock(tx, mergedItems)

    await tx.orderItem.deleteMany({ where: { orderId } })

    const goodsAmount = Number(mergedItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
    const commission = Number(mergedItems.reduce((sum, item) => sum + item.quantity * item.commission, 0).toFixed(2))
    const profitAmount = Number(mergedItems.reduce((sum, item) => sum + item.profit, 0).toFixed(2))

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        goodsAmount,
        commission,
        totalAmount: goodsAmount,
        profitAmount,
        items: { create: mergedItems.map(mapOrderItem) }
      },
      include: { items: true }
    })

    await recalculateCustomerDebt(order.customerId, tx)
    return updatedOrder
  })
}

async function confirmGoodsMutationFromDraft(mutation: GoodsMutationDraft) {
  const operation = mutation.operation
  if (!operation) {
    throw createError({ statusCode: 400, statusMessage: '缺少库存操作类型' })
  }

  const goodsName = String(mutation.goodsName || '').trim()
  if (!goodsName) {
    throw createError({ statusCode: 400, statusMessage: '缺少库存商品名称' })
  }

  const quantity = Number(mutation.quantity || 0)
  const unitType = mutation.unitType === 'weight' ? 'weight' : 'qty'
  const pricePatch = {
    ...(mutation.costPrice !== null && mutation.costPrice !== undefined ? { costPrice: Number(mutation.costPrice) } : {}),
    ...(mutation.salePrice !== null && mutation.salePrice !== undefined ? { salePrice: Number(mutation.salePrice) } : {}),
    ...(mutation.defaultCommission !== null && mutation.defaultCommission !== undefined ? { defaultCommission: Number(mutation.defaultCommission) } : {}),
    ...(mutation.saleCommission !== null && mutation.saleCommission !== undefined ? { saleCommission: Number(mutation.saleCommission) } : {})
  }

  if (operation === 'create') {
    if (quantity <= 0) throw createError({ statusCode: 400, statusMessage: '新增库存数量必须大于 0' })
    const created = await prisma.goods.create({
      data: {
        name: goodsName,
        unitType,
        stock: quantity,
        salePrice: Number(mutation.salePrice ?? mutation.costPrice ?? 0),
        costPrice: Number(mutation.costPrice ?? mutation.salePrice ?? 0),
        defaultCommission: Number(mutation.defaultCommission ?? 0),
        saleCommission: Number(mutation.saleCommission ?? 0),
        arrivedAt: new Date(),
        enabled: true
      }
    })
    return { type: 'goods_mutation', goods: created, message: `已新增“${created.name}”，当前库存 ${formatDecimal(created.stock)}。` }
  }

  const goodsId = Number(mutation.goodsId || 0)
  if (!goodsId) {
    throw createError({ statusCode: 400, statusMessage: '缺少库存商品 ID' })
  }

  if (operation === 'delete') {
    const updated = await prisma.goods.update({ where: { id: goodsId }, data: { enabled: false } })
    return { type: 'goods_mutation', goods: updated, message: `已删除库存商品“${updated.name}”。` }
  }

  if (operation === 'clear') {
    const updated = await prisma.goods.update({ where: { id: goodsId }, data: { stock: 0 } })
    return { type: 'goods_mutation', goods: updated, message: `已把“${updated.name}”库存清零。` }
  }

  if ((operation === 'increase' || operation === 'set') && quantity <= 0) {
    throw createError({ statusCode: 400, statusMessage: '库存数量必须大于 0' })
  }

  if (operation === 'increase') {
    const updated = await prisma.goods.update({
      where: { id: goodsId },
      data: {
        stock: { increment: quantity },
        unitType,
        ...pricePatch,
        arrivedAt: new Date()
      }
    })
    return { type: 'goods_mutation', goods: updated, message: `已给“${updated.name}”入库 ${formatDecimal(quantity)}，当前库存 ${formatDecimal(updated.stock)}。` }
  }

  if (operation === 'set') {
    const updated = await prisma.goods.update({
      where: { id: goodsId },
      data: {
        stock: quantity,
        unitType,
        ...pricePatch
      }
    })
    return { type: 'goods_mutation', goods: updated, message: `已把“${updated.name}”库存设置为 ${formatDecimal(updated.stock)}。` }
  }

  throw createError({ statusCode: 400, statusMessage: '不支持的库存操作类型' })
}

async function createSupplierEntryFromDraft(staffId: number, editable?: { supplierEntry?: Partial<SupplierEntryDraft> }) {
  const body = editable?.supplierEntry || {}
  const input = buildSupplierEntryInput({
    supplierName: body.supplierName,
    goodsName: body.goodsName,
    unitType: body.unitType,
    quantity: body.quantity,
    weight: body.weight,
    totalAmount: body.totalAmount,
    totalCommission: body.totalCommission ?? 0,
    saleCommission: body.saleCommission ?? 0,
    salePrice: body.salePrice,
    stockMode: body.stockMode || 'auto_stocked'
  })

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.upsert({
      where: { name: input.supplierName },
      update: {},
      create: { name: input.supplierName }
    })
    const goods = input.stockMode === 'auto_stocked'
      ? await upsertSupplierStockGoods(tx, input)
      : null
    const staff = await tx.staffUser.findUnique({
      where: { id: staffId },
      select: { name: true }
    })
    if (!staff) {
      throw createError({ statusCode: 404, statusMessage: '店员不存在' })
    }

    const entry = await tx.supplierEntry.create({
      data: {
        entryNo: createSupplierEntryNo(),
        supplierId: supplier.id,
        supplierName: supplier.name,
        staffId,
        staffName: staff.name,
        goodsId: goods?.id || null,
        goodsName: input.goodsName,
        unitType: input.unitType,
        quantity: input.quantity,
        weight: input.weight,
        totalAmount: input.totalAmount,
        totalCommission: input.totalCommission,
        costPrice: input.costPrice,
        commission: input.commission,
        saleCommission: input.saleCommission,
        salePrice: input.salePrice,
        stockMode: input.stockMode
      }
    })

    await recalculateSupplierDebt(supplier.id, tx)
    return mapSupplierEntry(entry)
  })
}

export async function confirmAiOperation(token: string, staffId: number, editable?: { customerName?: string, customerId?: number, items?: unknown, supplierEntry?: Partial<SupplierEntryDraft> }) {
  const draft = verifyDraft(token)
  if (!draft) {
    throw createError({ statusCode: 400, statusMessage: '操作凭证无效' })
  }
  if (draft.staffId !== staffId) {
    throw createError({ statusCode: 403, statusMessage: '该操作不属于当前账号' })
  }
  if (isExpired(draft.expiresAt)) {
    throw createError({ statusCode: 400, statusMessage: '操作草稿已过期，请重新识别' })
  }

  if (draft.kind === 'create_order') {
    return createOrderFromDraft(staffId, editable)
  }
  if (draft.kind === 'append_order' && draft.orderId) {
    return appendOrderFromDraft(draft.orderId, editable)
  }
  if (draft.kind === 'goods_mutation' && draft.goodsMutation) {
    return confirmGoodsMutationFromDraft(draft.goodsMutation)
  }
  if (draft.kind === 'create_supplier_entry') {
    return createSupplierEntryFromDraft(staffId, {
      supplierEntry: {
        ...draft.supplierEntry,
        ...(editable?.supplierEntry || {})
      }
    })
  }

  throw createError({ statusCode: 400, statusMessage: '不支持的小东操作类型' })
}
