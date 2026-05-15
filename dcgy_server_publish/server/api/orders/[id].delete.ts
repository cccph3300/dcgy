import { createError } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const order = await prisma.order.findUnique({ where: { id } })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: '订单不存在' })
  }
  if (order.status !== 'paid') {
    throw createError({ statusCode: 400, statusMessage: '只有已付清订单可以删除' })
  }

  await prisma.order.delete({ where: { id } })
  return { ok: true }
})
