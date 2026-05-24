import { readBody, createError } from 'h3'
import { requireStaff } from '../../utils/auth'
import { confirmAiOperation } from '../../utils/ai-data-actions'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const body = await readBody(event)
  const token = String(body?.token || '').trim()

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: '缺少操作凭证' })
  }

  const order = await confirmAiOperation(token, staff.id, {
    customerId: Number(body?.customerId || 0),
    customerName: String(body?.customerName || '').trim(),
    items: body?.items
  })
  return {
    success: true,
    order
  }
})
