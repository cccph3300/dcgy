import { createError, getQuery } from 'h3'
import type { Prisma } from '@prisma/client'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { dateRangeFromQuery, paginationFromQuery } from '../../../utils/print-record-query'
import { formatDecimal } from '../../../utils/number'

function actionText(action: string, amount: number) {
  if (action === 'entry_partial_payment') return amount < 0 ? '减少入账还款' : '入账部分还款'
  if (action === 'entry_pay_off') return '入账付清'
  return amount < 0 ? '减少部分还款' : '部分还款'
}

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '货主不存在' })
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true }
  })
  if (!supplier) {
    throw createError({ statusCode: 404, statusMessage: '货主不存在' })
  }

  const query = getQuery(event)
  const pagination = paginationFromQuery(query)
  const createdAt = query.startDate || query.endDate
    ? dateRangeFromQuery({ ...query, mode: 'range' })
    : undefined

  const where: Prisma.SupplierPaymentRecordWhereInput = {
    supplierId: id,
    ...(createdAt ? { createdAt } : {})
  }

  const [total, records] = await Promise.all([
    prisma.supplierPaymentRecord.count({ where }),
    prisma.supplierPaymentRecord.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ],
      skip: pagination.skip,
      take: pagination.take
    })
  ])

  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    records: records.map(record => ({
      id: record.id,
      time: record.createdAt,
      operator: record.staffName,
      entryTime: record.entryCreatedAt,
      entryId: record.entryId,
      entryNo: record.entryNo,
      action: record.action,
      actionText: actionText(record.action, Number(record.amount || 0)),
      amount: formatDecimal(record.amount),
      unpaidAmount: formatDecimal(record.unpaidAmount || 0)
    }))
  }
})
