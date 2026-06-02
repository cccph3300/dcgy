import { getQuery } from 'h3'
import { SupermarketOrderStatus } from '@prisma/client'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const SORT_LETTERS = `${LETTERS}#`
const PINYIN_BOUNDARIES = [
  ['A', '阿'],
  ['B', '芭'],
  ['C', '嚓'],
  ['D', '咑'],
  ['E', '妸'],
  ['F', '发'],
  ['G', '旮'],
  ['H', '铪'],
  ['J', '丌'],
  ['K', '咔'],
  ['L', '垃'],
  ['M', '嘸'],
  ['N', '拏'],
  ['O', '噢'],
  ['P', '妑'],
  ['Q', '七'],
  ['R', '呥'],
  ['S', '仨'],
  ['T', '他'],
  ['W', '屲'],
  ['X', '夕'],
  ['Y', '丫'],
  ['Z', '帀']
] as const

function getChineseInitial(char: string) {
  const code = char.charCodeAt(0)
  if (code < 0x4e00 || code > 0x9fa5) return ''
  for (let index = PINYIN_BOUNDARIES.length - 1; index >= 0; index -= 1) {
    const [letter, boundary] = PINYIN_BOUNDARIES[index]
    if (char.localeCompare(boundary, 'zh-Hans-CN-u-co-pinyin') >= 0) return letter
  }
  return ''
}

function getInitial(name: string) {
  const first = String(name || '').trim().charAt(0)
  if (!first) return '#'
  const upper = first.toUpperCase()
  if (/^[A-Z]$/.test(upper)) return upper
  const initial = getChineseInitial(first)
  return initial && LETTERS.includes(initial) ? initial : '#'
}

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const keyword = String(getQuery(event).q ?? '').trim()

  const rows = await prisma.supermarketOrder.groupBy({
    by: ['supermarketName', 'status'],
    where: {
      ...(keyword ? { supermarketName: { contains: keyword } } : {})
    },
    _sum: {
      totalAmount: true,
      totalProfit: true
    },
    _count: {
      _all: true
    }
  })

  const marketMap = new Map<string, {
    name: string
    totalAmount: number
    totalProfit: number
    orderCount: number
    unpaidAmount: number
    unpaidOrderCount: number
  }>()

  for (const row of rows) {
    const current = marketMap.get(row.supermarketName) || {
      name: row.supermarketName,
      totalAmount: 0,
      totalProfit: 0,
      orderCount: 0,
      unpaidAmount: 0,
      unpaidOrderCount: 0
    }
    const amount = Number(row._sum.totalAmount || 0)
    const profit = Number(row._sum.totalProfit || 0)
    if (row.status !== SupermarketOrderStatus.cancelled) {
      current.totalAmount += amount
      current.totalProfit += profit
    }
    current.orderCount += row._count._all
    if (row.status === SupermarketOrderStatus.active) {
      current.unpaidAmount += amount
      current.unpaidOrderCount += row._count._all
    }
    marketMap.set(row.supermarketName, current)
  }

  return Array.from(marketMap.values())
    .map(market => ({
      name: market.name,
      initial: getInitial(market.name),
      totalAmount: formatDecimal(market.totalAmount),
      totalProfit: formatDecimal(market.totalProfit),
      orderCount: market.orderCount,
      unpaidAmount: formatDecimal(market.unpaidAmount),
      unpaidOrderCount: market.unpaidOrderCount
    }))
    .sort((left, right) => {
      const initialCompare = SORT_LETTERS.indexOf(left.initial) - SORT_LETTERS.indexOf(right.initial)
      if (initialCompare !== 0) return initialCompare
      return left.name.localeCompare(right.name, 'zh-CN')
    })
})
