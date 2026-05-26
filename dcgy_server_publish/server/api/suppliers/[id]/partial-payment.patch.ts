import { createError, readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { formatDecimal, toMoney } from '../../../utils/number'
import { recalculateSupplierDebt } from '../../../utils/supplier-entries'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const amount = toMoney(body?.amount, '部分还款金额')

  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '货主不存在' })
  }

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!supplier) {
      throw createError({ statusCode: 404, statusMessage: '货主不存在' })
    }

    const result = await tx.supplierEntry.aggregate({
      where: {
        supplierId: id,
        status: 'unpaid'
      },
      _sum: { totalAmount: true }
    })
    const totalDebt = formatDecimal(result._sum.totalAmount || 0)
    if (amount > totalDebt) {
      throw createError({ statusCode: 400, statusMessage: '部分还款不能大于总欠账' })
    }

    await tx.supplier.update({
      where: { id },
      data: {
        totalDebt,
        partialPayment: amount
      }
    })
    await recalculateSupplierDebt(id, tx)

    return {
      ok: true,
      totalDebt,
      partialPayment: amount,
      unpaidAmount: formatDecimal(totalDebt - amount)
    }
  })
})
