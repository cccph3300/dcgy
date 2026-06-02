import { createError, readBody } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import {
  buildOrderAdjustments,
  mapOrderAdjustment,
  parseOrderAdjustmentRemark,
  sumOrderAdjustments
} from '../../utils/orders'
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
      include: { items: true, adjustments: true }
    })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '超市订单不存在' })
    }
    if (order.status === 'cancelled') {
      throw createError({ statusCode: 400, statusMessage: '已作废的超市订单不能修改' })
    }

    await restoreSupermarketStock(tx, order.items)
    const items = await buildSupermarketItems(tx, body?.items)
    const adjustments = buildOrderAdjustments(body?.adjustments)
    const adjustmentRemark = parseOrderAdjustmentRemark(body?.adjustmentRemark ?? body?.remark)
    await deductSupermarketStock(tx, items)
    const totals = summarizeSupermarketItems(items)
    totals.totalAmount = Number((totals.totalAmount + sumOrderAdjustments(adjustments)).toFixed(2))

    await tx.supermarketOrderItem.deleteMany({ where: { orderId: id } })
    await tx.supermarketOrderAdjustment.deleteMany({ where: { orderId: id } })

    const updated = await tx.supermarketOrder.update({
      where: { id },
      data: {
        supermarketName,
        adjustmentRemark,
        ...totals,
        items: { create: items.map(mapSupermarketItemForCreate) },
        adjustments: { create: adjustments.map(mapOrderAdjustment) }
      },
      include: { items: true, adjustments: true }
    })

    return mapSupermarketOrder(updated)
  })
})
