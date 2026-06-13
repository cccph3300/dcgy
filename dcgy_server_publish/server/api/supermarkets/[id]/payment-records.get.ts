import { createError, getQuery } from 'h3'
import type { Prisma } from '@prisma/client'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { dateRangeFromQuery, paginationFromQuery } from '../../../utils/print-record-query'
import { formatDecimal } from '../../../utils/number'

function actionText(action: string, amount: number) {
  if (action === 'order_partial_payment') return amount < 0 ? '减少订单还款' : '订单部分还款'
  if (action === 'order_pay_off') return '订单付清'
  return amount < 0 ? '减少部分还款' : '部分还款'
}

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '超市不存在' })
  }

  const account = await prisma.supermarketAccount.findUnique({
    where: { id },
    select: { id: true }
  })
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: '超市不存在' })
  }

  const query = getQuery(event)
  const pagination = paginationFromQuery(query)
  const createdAt = query.startDate || query.endDate
    ? dateRangeFromQuery({ ...query, mode: 'range' })
    : undefined

  const where: Prisma.SupermarketPaymentRecordWhereInput = {
    supermarketAccountId: id,
    ...(createdAt ? { createdAt } : {})
  }

  const [total, records] = await Promise.all([
    prisma.supermarketPaymentRecord.count({ where }),
    prisma.supermarketPaymentRecord.findMany({
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
      orderTime: record.orderCreatedAt,
      orderId: record.orderId,
      orderNo: record.orderNo,
      action: record.action,
      actionText: actionText(record.action, Number(record.amount || 0)),
      amount: formatDecimal(record.amount),
      unpaidAmount: formatDecimal(record.unpaidAmount || 0)
    }))
  }
})
