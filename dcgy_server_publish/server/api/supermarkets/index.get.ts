import { getQuery } from 'h3'
import { SupermarketOrderStatus } from '@prisma/client'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'
import { getInitial, SORT_INITIALS } from '../../utils/initial'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const keyword = String(getQuery(event).q ?? '').trim()

  const [rows, accounts] = await Promise.all([
    prisma.supermarketOrder.groupBy({
      by: ['supermarketName', 'status'],
      where: {
        ...(keyword ? { supermarketName: { contains: keyword } } : {})
      },
      _sum: {
        totalAmount: true,
        totalProfit: true,
        partialPayment: true
      },
      _count: {
        _all: true
      }
    }),
    prisma.supermarketAccount.findMany({
      where: {
        ...(keyword ? { name: { contains: keyword } } : {})
      },
      select: {
        name: true,
        partialPayment: true
      }
    })
  ])
  const accountPaymentMap = new Map(accounts.map(account => [account.name, Number(account.partialPayment || 0)]))

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
      current.unpaidAmount += Math.max(amount - Number(row._sum.partialPayment || 0), 0)
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
      unpaidAmount: formatDecimal(Math.max(market.unpaidAmount - Number(accountPaymentMap.get(market.name) || 0), 0)),
      unpaidOrderCount: market.unpaidOrderCount
    }))
    .sort((left, right) => {
      const initialCompare = SORT_INITIALS.indexOf(left.initial) - SORT_INITIALS.indexOf(right.initial)
      if (initialCompare !== 0) return initialCompare
      return left.name.localeCompare(right.name, 'zh-CN')
    })
})
