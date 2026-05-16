import { getQuery } from 'h3'
import { OrderStatus } from '@prisma/client'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const DEFAULT_CUSTOMER_NAME = '客户'
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

  const customers = await prisma.customer.findMany({
    where: {
      name: {
        not: DEFAULT_CUSTOMER_NAME,
        ...(keyword ? { contains: keyword } : {})
      }
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true
    }
  })
  const customerIds = customers.map(customer => customer.id)
  const debts = customerIds.length
    ? await prisma.order.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: customerIds },
          status: OrderStatus.unpaid
        },
        _sum: { totalAmount: true },
        _count: { _all: true }
      })
    : []
  const debtMap = new Map(debts.map(item => [item.customerId, item]))

  return customers
    .map((customer) => {
      const debt = debtMap.get(customer.id)
      const debtAmount = Number(debt?._sum.totalAmount || 0)
      return {
        id: customer.id,
        name: customer.name,
        initial: getInitial(customer.name),
        debtAmount: Number(debtAmount.toFixed(2)),
        unpaidOrderCount: debt?._count._all || 0
      }
    })
    .sort((left, right) => {
      const initialCompare = SORT_LETTERS.indexOf(left.initial) - SORT_LETTERS.indexOf(right.initial)
      if (initialCompare !== 0) return initialCompare
      return left.name.localeCompare(right.name, 'zh-CN')
    })
})
