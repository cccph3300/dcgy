import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { deductStock } from '../../../utils/orders'
import { recalculateCustomerDebt } from '../../../utils/customer-payments'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { goods: true }
        }
      }
    })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '订单不存在' })
    }
    if (order.status !== 'cancelled') {
      throw createError({ statusCode: 400, statusMessage: '只有已毁单订单可以还原' })
    }

    await deductStock(tx, order.items)
    const restoredOrder = await tx.order.update({
      where: { id },
      data: {
        status: 'unpaid',
        paidAt: null
      },
      include: { items: true }
    })
    await recalculateCustomerDebt(order.customerId, tx)
    return restoredOrder
  })
})
