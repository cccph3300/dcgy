import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { deductSupermarketStock, mapSupermarketOrder } from '../../../utils/supermarket-orders'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)

  return prisma.$transaction(async (tx) => {
    const order = await tx.supermarketOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: { goods: true }
        }
      }
    })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '超市订单不存在' })
    }
    if (order.status !== 'cancelled') {
      throw createError({ statusCode: 400, statusMessage: '只有已作废超市订单可以还原' })
    }

    const items = order.items.map(item => ({
      type: item.type,
      goodsId: item.goodsId,
      goodsName: item.goodsName,
      unitType: item.unitType,
      quantity: Number(item.quantity),
      weight: item.weight === null ? null : Number(item.weight),
      price: Number(item.price),
      commission: Number(item.commission),
      costPrice: Number(item.costPrice),
      subtotal: Number(item.subtotal),
      costAmount: Number(item.costAmount),
      profit: Number(item.profit),
      stockGoods: item.goods
        ? {
            id: item.goods.id,
            name: item.goods.name,
            stock: item.goods.stock
          }
        : undefined
    }))

    await deductSupermarketStock(tx, items)

    const updated = await tx.supermarketOrder.update({
      where: { id },
      data: {
        status: 'active',
        cancelledAt: null
      },
      include: {
        items: true,
        adjustments: { orderBy: { sortOrder: 'asc' } }
      }
    })

    return mapSupermarketOrder(updated)
  })
})
