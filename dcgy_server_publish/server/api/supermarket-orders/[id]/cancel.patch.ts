import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { mapSupermarketOrder, restoreSupermarketStock } from '../../../utils/supermarket-orders'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)

  return prisma.$transaction(async (tx) => {
    const order = await tx.supermarketOrder.findUnique({
      where: { id },
      include: { items: true }
    })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '超市订单不存在' })
    }
    if (order.status === 'cancelled') {
      throw createError({ statusCode: 400, statusMessage: '超市订单已作废' })
    }

    await restoreSupermarketStock(tx, order.items)

    const updated = await tx.supermarketOrder.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date()
      },
      include: { items: true }
    })

    return mapSupermarketOrder(updated)
  })
})
