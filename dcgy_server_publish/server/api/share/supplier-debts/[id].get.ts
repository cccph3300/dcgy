import { createError, getQuery } from 'h3'
import { verifySupplierDebtShareToken } from '../../../utils/debt-share'
import { getSupplierDebt } from '../../../utils/supplier-debt'

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const token = String(getQuery(event).token ?? '')
  if (!Number.isFinite(id) || id <= 0 || !verifySupplierDebtShareToken(id, token)) {
    throw createError({ statusCode: 403, statusMessage: '分享已失效' })
  }

  const debt = await getSupplierDebt(id)
  if (!debt) {
    throw createError({ statusCode: 404, statusMessage: '货主不存在' })
  }

  return debt
})
