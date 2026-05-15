import { getQuery } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { dateRangeFromQuery, paginationFromQuery } from '../../../utils/print-record-query'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const { page, pageSize, skip, take } = paginationFromQuery(query)
  const createdAt = dateRangeFromQuery(query)
  const where = Object.keys(createdAt).length ? { createdAt } : {}

  const [total, items] = await Promise.all([
    prisma.printRecord.count({ where }),
    prisma.printRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        type: true,
        status: true,
        staffName: true,
        orderNo: true,
        customerName: true,
        printerSn: true,
        errorMessage: true,
        createdAt: true
      }
    })
  ])

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
})
