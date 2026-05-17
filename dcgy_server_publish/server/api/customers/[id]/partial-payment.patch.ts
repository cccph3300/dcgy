import { createError, readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { toMoney, formatDecimal } from '../../../utils/number'
import { recalculateCustomerDebt } from '../../../utils/customer-payments'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const amount = toMoney(body?.amount, '部分还款金额')

  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '客户不存在' })
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!customer) {
      throw createError({ statusCode: 404, statusMessage: '客户不存在' })
    }

    const result = await tx.order.aggregate({
      where: {
        customerId: id,
        status: 'unpaid'
      },
      _sum: { totalAmount: true }
    })
    const totalDebt = formatDecimal(result._sum.totalAmount || 0)
    if (amount > totalDebt) {
      throw createError({ statusCode: 400, statusMessage: '部分还款不能大于总欠账' })
    }

    await tx.customer.update({
      where: { id },
      data: {
        totalDebt,
        partialPayment: amount
      }
    })
    await recalculateCustomerDebt(id, tx)

    return {
      ok: true,
      totalDebt,
      partialPayment: amount,
      unpaidAmount: formatDecimal(totalDebt - amount)
    }
  })
})
