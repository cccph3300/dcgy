import { createError, getQuery } from 'h3'
import { verifyDebtShareToken } from '../../../utils/debt-share'
import { getCustomerDebt } from '../../../utils/customer-debt'

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const token = String(getQuery(event).token ?? '')
  if (!Number.isFinite(id) || id <= 0 || !verifyDebtShareToken(id, token)) {
    throw createError({ statusCode: 403, statusMessage: '分享已失效' })
  }

  const debt = await getCustomerDebt(id)
  if (!debt) {
    throw createError({ statusCode: 404, statusMessage: '客户不存在' })
  }

  return debt
})
