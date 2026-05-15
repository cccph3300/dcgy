import { createError, readBody } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import {
  assertSupermarketName,
  buildSupermarketItems,
  deductSupermarketStock,
  mapSupermarketItemForCreate,
  mapSupermarketOrder,
  restoreSupermarketStock,
  summarizeSupermarketItems
} from '../../utils/supermarket-orders'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const supermarketName = assertSupermarketName(body?.supermarketName)

  return prisma.$transaction(async (tx) => {
    const order = await tx.supermarketOrder.findUnique({
      where: { id },
      include: { items: true }
    })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '超市订单不存在' })
    }
    if (order.status === 'cancelled') {
      throw createError({ statusCode: 400, statusMessage: '已作废的超市订单不能修改' })
    }

    await restoreSupermarketStock(tx, order.items)
    const items = await buildSupermarketItems(tx, body?.items)
    await deductSupermarketStock(tx, items)
    const totals = summarizeSupermarketItems(items)

    await tx.supermarketOrderItem.deleteMany({ where: { orderId: id } })

    const updated = await tx.supermarketOrder.update({
      where: { id },
      data: {
        supermarketName,
        ...totals,
        items: { create: items.map(mapSupermarketItemForCreate) }
      },
      include: { items: true }
    })

    return mapSupermarketOrder(updated)
  })
})
