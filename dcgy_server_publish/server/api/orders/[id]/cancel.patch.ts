import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { restoreStock } from '../../../utils/orders'
import { recalculateCustomerDebt } from '../../../utils/customer-payments'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { items: true }
    })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '订单不存在' })
    }
    if (order.status !== 'unpaid') {
      throw createError({ statusCode: 400, statusMessage: '只有未付订单可以毁单' })
    }

    await restoreStock(tx, order.items)
    const cancelledOrder = await tx.order.update({
      where: { id },
      data: { status: 'cancelled' }
    })
    await recalculateCustomerDebt(order.customerId, tx)
    return cancelledOrder
  })
})
