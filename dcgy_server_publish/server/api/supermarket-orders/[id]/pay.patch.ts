import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { mapSupermarketOrder } from '../../../utils/supermarket-orders'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const order = await prisma.supermarketOrder.findUnique({
    where: { id },
    include: { items: true }
  })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: '超市订单不存在' })
  }
  if (order.status !== 'active') {
    throw createError({ statusCode: 400, statusMessage: '只有未结超市订单可以结账' })
  }

  const updated = await prisma.supermarketOrder.update({
    where: { id },
    data: { status: 'paid' },
    include: { items: true }
  })

  return mapSupermarketOrder(updated)
})
