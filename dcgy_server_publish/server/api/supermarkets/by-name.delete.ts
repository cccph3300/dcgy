import { createError, getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const name = String(getQuery(event).name ?? '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '请传入超市名称' })
  }

  const orderCount = await prisma.supermarketOrder.count({
    where: { supermarketName: name }
  })
  if (orderCount > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: '该超市有订单，不允许删除，请将订单全部删除才能删除超市'
    })
  }

  return { ok: true }
})
