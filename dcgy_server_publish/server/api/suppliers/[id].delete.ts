import { createError } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '货主不存在' })
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true, name: true }
  })
  if (!supplier) {
    throw createError({ statusCode: 404, statusMessage: '货主不存在' })
  }

  const entryCount = await prisma.supplierEntry.count({ where: { supplierId: id } })
  if (entryCount > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: '该货主有入账记录或欠款，不允许删除，请将入账记录全部删除才能删除货主'
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.supplierPaymentRecord.deleteMany({ where: { supplierId: id } })
    await tx.supplier.delete({ where: { id } })
  })
  return { ok: true }
})
