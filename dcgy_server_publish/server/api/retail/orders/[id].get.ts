import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { mapRetailOrder } from '../../../utils/retail'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '订单ID不正确' })
  }

  const order = await prisma.retailOrder.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: '零售订单不存在' })
  }

  return mapRetailOrder(order)
})
