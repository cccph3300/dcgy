import { getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const query = getQuery(event)
  const date = String(query.date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()))
  const supermarketName = String(query.supermarketName ?? '').trim()
  const status = String(query.status ?? '').trim()
  const page = Math.max(Number(query.page || 1), 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 50)
  const where: Record<string, unknown> = {
    ...(supermarketName ? { supermarketName: { contains: supermarketName } } : {}),
    ...(status === 'active' || status === 'paid' || status === 'cancelled' ? { status } : {})
  }

  if (date !== 'all') {
    const [year, month, day] = date.split('-').map(Number)
    const start = new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0))
    const end = new Date(Date.UTC(year, month - 1, day + 1, -8, 0, 0, -1))
    where.createdAt = { gte: start, lte: end }
  }

  const [total, orders, summaryRows] = await Promise.all([
    prisma.supermarketOrder.count({ where }),
    prisma.supermarketOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true }
    }),
    prisma.supermarketOrder.groupBy({
      by: ['status'],
      where,
      _sum: {
        totalAmount: true,
        totalCost: true,
        totalCommission: true,
        totalProfit: true
      }
    })
  ])

  const summary = summaryRows.reduce((result, row) => {
    if (row.status !== 'cancelled') {
      result.totalAmount += Number(row._sum.totalAmount || 0)
      result.totalCost += Number(row._sum.totalCost || 0)
      result.totalCommission += Number(row._sum.totalCommission || 0)
      result.totalProfit += Number(row._sum.totalProfit || 0)
    }
    return result
  }, { totalAmount: 0, totalCost: 0, totalCommission: 0, totalProfit: 0 })

  return {
    items: orders.map(order => ({
      id: order.id,
      orderNo: order.orderNo,
      supermarketName: order.supermarketName,
      staffName: order.staffName,
      status: order.status,
      totalAmount: formatDecimal(order.totalAmount),
      totalCost: formatDecimal(order.totalCost),
      totalCommission: formatDecimal(order.totalCommission),
      totalProfit: formatDecimal(order.totalProfit),
      itemCount: order.items.length,
      createdAt: order.createdAt,
      cancelledAt: order.cancelledAt
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1)
    },
    summary: {
      totalAmount: formatDecimal(summary.totalAmount),
      totalCost: formatDecimal(summary.totalCost),
      totalCommission: formatDecimal(summary.totalCommission),
      totalProfit: formatDecimal(summary.totalProfit)
    }
  }
})
