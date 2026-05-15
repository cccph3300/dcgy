import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { mapSupermarketSheet } from '../../../utils/supermarket-orders'

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

  return mapSupermarketSheet(order)
})
