import { createError, getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { getSupermarketDebt } from '../../utils/supermarket-debt'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const name = String(getQuery(event).name ?? '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '请传入超市名称' })
  }

  return getSupermarketDebt(name)
})
