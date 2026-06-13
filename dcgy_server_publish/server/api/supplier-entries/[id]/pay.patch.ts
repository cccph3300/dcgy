import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { applyPaidEntryToSupplier, mapSupplierEntry, recalculateSupplierDebt } from '../../../utils/supplier-entries'
import { formatDecimal } from '../../../utils/number'
import { createSupplierPaymentRecord, getSupplierUnpaidAmount } from '../../../utils/supplier-payment-records'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = Number(event.context.params?.id)
  const entry = await prisma.supplierEntry.findUnique({ where: { id } })
  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: '入账记录不存在' })
  }
  if (entry.status !== 'unpaid') {
    throw createError({ statusCode: 400, statusMessage: '只有未付入账记录可以标记付清' })
  }

  return prisma.$transaction(async (tx) => {
    await applyPaidEntryToSupplier(entry, tx)
    const paidEntry = await tx.supplierEntry.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date() }
    })
    await recalculateSupplierDebt(entry.supplierId, tx)
    const unpaidAmount = await getSupplierUnpaidAmount(entry.supplierId, tx)
    await createSupplierPaymentRecord({
      tx,
      supplier: { id: entry.supplierId, name: entry.supplierName },
      staff,
      action: 'entry_pay_off',
      amount: formatDecimal(Number(entry.totalAmount || 0) - Number(entry.partialPayment || 0)),
      unpaidAmount,
      entry
    })
    return mapSupplierEntry(paidEntry)
  })
})
