import { createHash } from 'node:crypto'
import { createError } from 'h3'

type PrintItem = {
  goodsName: string
  quantity?: number | string
  weight?: number | string | null
  price?: number | string
  commission?: number | string
  subtotal?: number | string
}

type PrintAdjustment = {
  name: string
  type?: 'add' | 'subtract' | string
  amount?: number | string
}

type PrintOrder = {
  orderNo?: string
  customerName?: string
  staffName?: string
  createdAt?: string | Date
  totalAmount?: number | string
  adjustmentRemark?: string | null
  adjustments?: PrintAdjustment[]
  items?: PrintItem[]
}

type DebtPrintOrder = {
  orderNo: string
  createdAt: string | Date
  totalAmount: number | string
  adjustmentRemark?: string | null
  adjustments?: PrintAdjustment[]
  items: PrintItem[]
}

type DebtPrintData = {
  customer: { name: string }
  staffName?: string
  totalAmount: number | string
  orderCount: number
  orders: DebtPrintOrder[]
}

function getEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw createError({ statusCode: 500, statusMessage: `缺少打印配置：${name}` })
  }
  return value
}

function receiptNumber(value: unknown) {
  const num = Number(value || 0)
  const rounded = Math.round(num * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function receiptText(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '＆')
    .replace(/</g, '＜')
    .replace(/>/g, '＞')
}

function receiptByteLength(value: string) {
  return Array.from(value).reduce((total, char) => {
    return total + (char.charCodeAt(0) <= 0x7f ? 1 : 2)
  }, 0)
}

function receiptCell(value: unknown, width: number) {
  const text = receiptText(value)
  return text.length >= width ? text.slice(0, width) : text.padEnd(width, ' ')
}

function bigLine(text: unknown) {
  return `<FONT w="0" h="1">${receiptText(text)}</FONT><BR>`
}

function rightBigLine(text: unknown) {
  return `<R><FONT w="1" h="1">${receiptText(text)}</FONT><BR></R>`
}

function rightTotalLine(text: unknown) {
  return `<R><FONT w="2" h="2">${receiptText(text)}</FONT><BR></R>`
}

function titleBlock(subtitle?: string) {
  return [
    '<BR>',
    '<BR>',
    '<CB>东成果业</CB><BR>',
    '<BR>',
    '<BR>',
    subtitle ? `<CB>${receiptText(subtitle)}</CB><BR>` : ''
  ].join('')
}

function footerBlock() {
  return [
    '--------------------------------<BR>',
    '<BR>',
    '<CB>谢谢惠顾</CB><BR>',
    '<CB>欢迎再次光临</CB><BR>',
    '<CB>东成果业A1区112</CB><BR>',
    '<BR>',
    '<CUT>'
  ].join('')
}

function itemHeaderLine() {
  return bigLine('品名/件  重量  单价  佣金  小计')
}

function itemRows(item: PrintItem) {
  const commission = Number(item.commission || 0) > 0 ? receiptNumber(item.commission) : '-'
  const weight = item.weight ? receiptNumber(item.weight) : '-'
  return [
    bigLine(item.goodsName || '货物'),
    bigLine([
      receiptCell(`${receiptNumber(item.quantity || 0)}件`, 8),
      receiptCell(weight, 6),
      receiptCell(receiptNumber(item.price || 0), 6),
      receiptCell(commission, 6),
      receiptNumber(item.subtotal || 0)
    ].join(''))
  ].join('')
}

function adjustmentRows(order: PrintOrder) {
  const rows: string[] = []
  const remark = String(order.adjustmentRemark || '').trim()
  const adjustments = order.adjustments || []

  if (remark) {
    rows.push(bigLine(`备注:${remark}`))
  }

  for (const item of adjustments) {
    const name = String(item.name || '').trim()
    const amount = Number(item.amount || 0)
    if (!name || amount <= 0) continue
    const sign = item.type === 'subtract' ? '-' : '+'
    rows.push(bigLine(`${name} ${sign}${receiptNumber(amount)}`))
  }

  return rows
}

function formatTime(value?: string | Date) {
  const date = value ? new Date(value) : new Date()
  const realDate = Number.isNaN(date.getTime()) ? new Date() : date
  const year = realDate.getFullYear()
  const month = String(realDate.getMonth() + 1).padStart(2, '0')
  const day = String(realDate.getDate()).padStart(2, '0')
  const hour = String(realDate.getHours()).padStart(2, '0')
  const minute = String(realDate.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function formatShortDate(value?: string | Date) {
  const date = value ? new Date(value) : new Date()
  const realDate = Number.isNaN(date.getTime()) ? new Date() : date
  const year = String(realDate.getFullYear()).slice(-2)
  const month = String(realDate.getMonth() + 1).padStart(2, '0')
  const day = String(realDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatShortHour(value?: string | Date) {
  const date = value ? new Date(value) : new Date()
  const realDate = Number.isNaN(date.getTime()) ? new Date() : date
  return `${formatShortDate(realDate)} ${realDate.getHours()}点`
}

export function buildXpyunReceipt(order: PrintOrder) {
  const items = order.items || []
  const content = [
    titleBlock(),
    bigLine(`店员:${receiptText(order.staffName || '')}`),
    bigLine(`时间:${formatTime(order.createdAt)}`),
    bigLine(`买家:${receiptText(order.customerName || '客户')}`),
    '--------------------------------<BR>',
    itemHeaderLine()
  ]

  if (order.orderNo) {
    content.splice(2, 0, bigLine(`账单号:${receiptText(order.orderNo)}`))
  }

  for (const item of items) {
    content.push(itemRows(item))
  }

  content.push(
    '--------------------------------<BR>',
    ...adjustmentRows(order),
    rightTotalLine(`合计:${receiptNumber(order.totalAmount || 0)}`),
    footerBlock()
  )
  return content.join('')
}

export function buildXpyunDebtReceipt(debt: DebtPrintData) {
  const content = [
    titleBlock('客户欠账单'),
    `<CB>客户:${receiptText(debt.customer.name || '客户')}</CB><BR>`,
    bigLine(`时间:${formatShortHour()}`),
    bigLine(`店员:${receiptText(debt.staffName || '')}`),
    bigLine(`未付笔数:${debt.orderCount || 0}单`),
    '--------------------------------<BR>'
  ]

  for (const order of debt.orders || []) {
    content.push(
      bigLine(`账单号:${receiptText(order.orderNo)}`),
      bigLine(`日期:${formatShortHour(order.createdAt)}  金额:${receiptNumber(order.totalAmount)}`),
      itemHeaderLine()
    )

    for (const item of order.items || []) {
      content.push(itemRows(item))
    }

    content.push(...adjustmentRows(order))
    content.push('--------------------------------<BR>')
  }

  content.push(rightBigLine(`欠款合计:${receiptNumber(debt.totalAmount || 0)}`))
  content.push(footerBlock())
  return content.join('')
}

export async function sendXpyunPrint(content: string) {
  if (receiptByteLength(content) > 12 * 1024) {
    throw createError({
      statusCode: 400,
      statusMessage: '打印内容超过芯烨云12K限制，请减少账单条数后再打印'
    })
  }

  const user = getEnv('XPYUN_USER')
  const userKey = getEnv('XPYUN_USER_KEY')
  const sn = getEnv('XPYUN_SN')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const sign = createHash('sha1').update(`${user}${userKey}${timestamp}`).digest('hex')

  const response = await fetch('https://open.xpyun.net/api/openapi/xprinter/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({
      user,
      timestamp,
      sign,
      sn,
      content,
      copies: Number(process.env.XPYUN_COPIES || 1),
      mode: Number(process.env.XPYUN_MODE || 0)
    })
  })

  const result = await response.json().catch(() => null)
  if (!response.ok || !result) {
    throw createError({ statusCode: 502, statusMessage: '芯烨云打印请求失败' })
  }

  const code = Number(result.code)
  if (code !== 0) {
    throw createError({
      statusCode: 502,
      statusMessage: result.msg || result.message || '芯烨云打印失败'
    })
  }

  return result
}
