import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const order = await prisma.supermarketOrder.findUnique({ where: { id } })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: '超市订单不存在' })
  }
  if (order.status !== 'cancelled') {
    throw createError({ statusCode: 400, statusMessage: '只有回收站中的作废超市订单可以彻底删除' })
  }

  await prisma.supermarketOrder.delete({ where: { id } })
  return { ok: true }
})
