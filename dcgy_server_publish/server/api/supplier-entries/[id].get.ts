import { createError } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { mapSupplierEntry } from '../../utils/supplier-entries'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const entry = await prisma.supplierEntry.findUnique({ where: { id } })
  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: '入账记录不存在' })
  }
  const supplier = entry.status === 'unpaid'
    ? await prisma.supplier.findUnique({
        where: { id: entry.supplierId },
        select: { partialPayment: true }
      })
    : null
  return {
    ...mapSupplierEntry(entry),
    availablePartialPayment: entry.status === 'unpaid' ? Number(supplier?.partialPayment || 0) : 0
  }
})
