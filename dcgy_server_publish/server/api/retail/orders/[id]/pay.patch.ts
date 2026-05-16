import { createError } from 'h3'
import { requireStaff } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { mapRetailOrder } from '../../../../utils/retail'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '订单ID不正确' })
  }

  const order = await prisma.retailOrder.update({
    where: { id },
    data: { status: 'paid', paidAt: new Date() },
    include: { items: true }
  })

  return mapRetailOrder(order)
})
