import { createError, readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { toMoney, formatDecimal } from '../../../utils/number'
import { recalculateSupplierDebt } from '../../../utils/supplier-entries'
import { prisma } from '../../../utils/prisma'
import { createSupplierPaymentRecord, getSupplierUnpaidAmount } from '../../../utils/supplier-payment-records'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const amount = toMoney(body?.amount, '入账部分还款金额')

  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '入账记录不存在' })
  }

  return prisma.$transaction(async (tx) => {
    const entry = await tx.supplierEntry.findUnique({ where: { id } })
    if (!entry) {
      throw createError({ statusCode: 404, statusMessage: '入账记录不存在' })
    }
    if (entry.status !== 'unpaid') {
      throw createError({ statusCode: 400, statusMessage: '只有未付入账记录可以记录部分还款' })
    }

    const totalAmount = formatDecimal(entry.totalAmount || 0)
    if (amount > totalAmount) {
      throw createError({ statusCode: 400, statusMessage: '入账部分还款不能大于入账总计' })
    }

    const supplier = await tx.supplier.findUnique({
      where: { id: entry.supplierId },
      select: { id: true, name: true, partialPayment: true }
    })
    if (!supplier) {
      throw createError({ statusCode: 400, statusMessage: '货主不存在' })
    }

    const currentEntryPartialPayment = formatDecimal(entry.partialPayment || 0)
    const availablePartialPayment = formatDecimal(supplier.partialPayment || 0)
    const diffAmount = formatDecimal(amount - currentEntryPartialPayment)
    if (diffAmount > availablePartialPayment) {
      throw createError({ statusCode: 400, statusMessage: '入账部分还款不能大于当前货主未分配还款金额' })
    }

    const paidOff = amount >= totalAmount
    const paidAt = paidOff ? new Date() : null
    await tx.supplierEntry.update({
      where: { id },
      data: {
        partialPayment: amount,
        status: paidOff ? 'paid' : 'unpaid',
        paidAt
      }
    })
    await tx.supplier.update({
      where: { id: entry.supplierId },
      data: { partialPayment: formatDecimal(availablePartialPayment - diffAmount) }
    })
    await recalculateSupplierDebt(entry.supplierId, tx)
    const supplierUnpaidAmount = await getSupplierUnpaidAmount(entry.supplierId, tx)
    await createSupplierPaymentRecord({
      tx,
      supplier,
      staff,
      action: paidOff ? 'entry_pay_off' : 'entry_partial_payment',
      amount: diffAmount,
      unpaidAmount: supplierUnpaidAmount,
      entry
    })

    return {
      ok: true,
      entryId: id,
      status: paidOff ? 'paid' : 'unpaid',
      paidAt,
      partialPayment: amount,
      supplierPartialPayment: formatDecimal(availablePartialPayment - diffAmount),
      unpaidAmount: paidOff ? 0 : formatDecimal(totalAmount - amount),
      supplierUnpaidAmount
    }
  })
})
