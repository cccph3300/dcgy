import { createError } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { mapSupermarketOrder } from '../../utils/supermarket-orders'
import { ensureSupermarketAccount } from '../../utils/supermarket-payments'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const order = await prisma.supermarketOrder.findUnique({
    where: { id },
    include: {
      items: true,
      adjustments: { orderBy: { sortOrder: 'asc' } }
    }
  })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: '超市订单不存在' })
  }

  const mapped = mapSupermarketOrder(order)
  const account = order.status === 'active'
    ? await ensureSupermarketAccount(order.supermarketName)
    : null

  return {
    ...mapped,
    availablePartialPayment: account ? account.partialPayment : 0
  }
})
