import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { getSupplierDebt } from '../../../utils/supplier-debt'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '货主不存在' })
  }

  const debt = await getSupplierDebt(id)
  if (!debt) {
    throw createError({ statusCode: 404, statusMessage: '货主不存在' })
  }

  return debt
})
