import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { applyPaidEntryToSupplier, mapSupplierEntry, recalculateSupplierDebt } from '../../../utils/supplier-entries'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
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
    return mapSupplierEntry(paidEntry)
  })
})
