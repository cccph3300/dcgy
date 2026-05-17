import { getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'
import { dateWhereFromQuery, todayInChina } from '../../utils/date-query'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const query = getQuery(event)
  const date = String(query.date ?? todayInChina())
  const customer = String(query.customer ?? '').trim()
  const customerId = Number(query.customerId || 0)
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 300)
  const hasPagination = query.page !== undefined || query.pageSize !== undefined
  const page = Math.max(Number(query.page || 1), 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 50)
  const where: Record<string, unknown> = {
    ...(Number.isFinite(customerId) && customerId > 0
      ? { customerId }
      : customer
        ? { customerName: { contains: customer } }
        : {})
  }

  if (String(query.mode || '') === 'range' || date === 'range') {
    where.createdAt = dateWhereFromQuery(query)
  } else if (date === 'all') {
    // 未选具体客户时，“全部时间”只查最近一年，避免历史订单过多拖慢小程序。
    // 已选具体客户时必须查该客户全部历史，避免客户对账漏单。
    if (!(Number.isFinite(customerId) && customerId > 0)) {
      const now = new Date()
      const oneYearAgo = new Date(now)
      oneYearAgo.setFullYear(now.getFullYear() - 1)
      where.createdAt = { gte: oneYearAgo }
    }
  } else {
    where.createdAt = dateWhereFromQuery({ ...query, day: date })
  }

  const [total, orders, summaryRows] = await Promise.all([
    hasPagination ? prisma.order.count({ where }) : Promise.resolve(0),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: hasPagination ? (page - 1) * pageSize : 0,
      take: hasPagination ? pageSize : limit,
      include: { items: true }
    }),
    hasPagination
      ? prisma.order.groupBy({
        by: ['status'],
        where,
        _sum: { totalAmount: true, profitAmount: true }
      })
      : Promise.resolve([])
  ])

  const items = orders.map(order => ({
    id: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    staffName: order.staffName,
    status: order.status,
    totalAmount: formatDecimal(order.totalAmount),
    commission: formatDecimal(order.commission),
    profitAmount: formatDecimal(order.profitAmount),
    createdAt: order.createdAt,
    itemCount: order.items.length
  }))

  if (!hasPagination) return items

  const summary = summaryRows.reduce((result, row) => {
    const amount = Number(row._sum.totalAmount || 0)
    const profit = Number(row._sum.profitAmount || 0)
    if (row.status === 'paid') result.paidAmount += amount
    if (row.status === 'unpaid') result.unpaidAmount += amount
    if (row.status !== 'cancelled') result.profitAmount += profit
    return result
  }, { paidAmount: 0, unpaidAmount: 0, profitAmount: 0 })

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1)
    },
    summary: {
      totalAmount: formatDecimal(summary.paidAmount + summary.unpaidAmount),
      paidAmount: formatDecimal(summary.paidAmount),
      unpaidAmount: formatDecimal(summary.unpaidAmount),
      profitAmount: formatDecimal(summary.profitAmount)
    }
  }
})
