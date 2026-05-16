import { getQuery } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { formatDecimal } from '../../../utils/number'
import { dateRangeFromQuery, paginationFromQuery } from '../../../utils/print-record-query'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const { page, pageSize, skip, take } = paginationFromQuery(query)
  const createdAt = dateRangeFromQuery(query)
  const customer = String(query.customer || '').trim()
  const status = String(query.status || 'all')
  const where = {
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(customer ? { customerName: { contains: customer } } : {}),
    ...(status === 'paid' || status === 'unpaid' ? { status } : {})
  }

  const [total, orders, summaryRows] = await Promise.all([
    prisma.retailOrder.count({ where }),
    prisma.retailOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { items: true }
    }),
    prisma.retailOrder.groupBy({
      by: ['status'],
      where,
      _sum: { totalAmount: true }
    })
  ])

  const summary = summaryRows.reduce((result, row) => {
    const amount = Number(row._sum.totalAmount || 0)
    if (row.status === 'paid') result.paidAmount += amount
    if (row.status === 'unpaid') result.unpaidAmount += amount
    return result
  }, { paidAmount: 0, unpaidAmount: 0 })

  return {
    items: orders.map(order => ({
      id: order.id,
      orderNo: order.orderNo,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      staffName: order.staffName,
      status: order.status,
      totalAmount: formatDecimal(order.totalAmount),
      itemCount: order.items.length,
      createdAt: order.createdAt
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary: {
      totalAmount: formatDecimal(summary.paidAmount + summary.unpaidAmount),
      paidAmount: formatDecimal(summary.paidAmount),
      unpaidAmount: formatDecimal(summary.unpaidAmount)
    }
  }
})
