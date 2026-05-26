import { getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { dateWhereFromQuery, todayInChina } from '../../utils/date-query'
import { formatDecimal } from '../../utils/number'
import { mapSupplierEntry } from '../../utils/supplier-entries'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const date = String(query.date ?? todayInChina())
  const supplierName = String(query.supplierName ?? '').trim()
  const status = String(query.status ?? '').trim()
  const page = Math.max(Number(query.page || 1), 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 50)
  const where: Record<string, unknown> = {
    ...(supplierName ? { supplierName: { contains: supplierName } } : {}),
    ...(status === 'unpaid' || status === 'paid' ? { status } : {})
  }

  if (date !== 'all') where.createdAt = dateWhereFromQuery({ ...query, day: date })

  const [total, entries, summaryRows] = await Promise.all([
    prisma.supplierEntry.count({ where }),
    prisma.supplierEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.supplierEntry.groupBy({
      by: ['status'],
      where,
      _sum: {
        totalAmount: true,
        totalCommission: true
      }
    })
  ])

  const summary = summaryRows.reduce((result, row) => {
    const amount = Number(row._sum.totalAmount || 0)
    if (row.status === 'paid') result.paidAmount += amount
    if (row.status === 'unpaid') result.unpaidAmount += amount
    result.totalCommission += Number(row._sum.totalCommission || 0)
    return result
  }, { paidAmount: 0, unpaidAmount: 0, totalCommission: 0 })

  return {
    items: entries.map(mapSupplierEntry),
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
      totalCommission: formatDecimal(summary.totalCommission)
    }
  }
})
