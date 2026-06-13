import { createError, readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { formatDecimal, toMoney } from '../../../utils/number'
import { recalculateSupplierDebt } from '../../../utils/supplier-entries'
import { createSupplierPaymentRecord, getSupplierUnpaidAmount } from '../../../utils/supplier-payment-records'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const amount = toMoney(body?.amount, '部分还款金额')

  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '货主不存在' })
  }

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({
      where: { id },
      select: { id: true, name: true, partialPayment: true }
    })
    if (!supplier) {
      throw createError({ statusCode: 404, statusMessage: '货主不存在' })
    }

    const entries = await tx.supplierEntry.findMany({
      where: {
        supplierId: id,
        status: 'unpaid'
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ],
      select: {
        id: true,
        totalAmount: true,
        partialPayment: true
      }
    })
    const totalDebt = formatDecimal(entries.reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0))
    const allocatedPartialPayment = formatDecimal(entries.reduce((sum, entry) => {
      return sum + Math.min(Number(entry.partialPayment || 0), Number(entry.totalAmount || 0))
    }, 0))
    const maxAvailablePayment = formatDecimal(Math.max(totalDebt - allocatedPartialPayment, 0))
    if (amount > maxAvailablePayment) {
      throw createError({ statusCode: 400, statusMessage: '部分还款不能大于未分配欠账' })
    }

    const previousPartialPayment = formatDecimal(supplier.partialPayment || 0)
    await tx.supplier.update({
      where: { id },
      data: {
        totalDebt,
        partialPayment: amount
      }
    })
    await recalculateSupplierDebt(id, tx)
    const unpaidAmount = await getSupplierUnpaidAmount(id, tx)
    await createSupplierPaymentRecord({
      tx,
      supplier,
      staff,
      action: 'supplier_partial_payment',
      amount: formatDecimal(amount - previousPartialPayment),
      unpaidAmount
    })

    return {
      ok: true,
      totalDebt,
      partialPayment: amount,
      availablePartialPayment: amount,
      allocatedPartialPayment,
      unpaidAmount
    }
  })
})
