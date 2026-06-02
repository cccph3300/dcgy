import { readBody } from 'h3'
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
  createSupermarketOrderNo,
  deductSupermarketStock,
  mapSupermarketItemForCreate,
  mapSupermarketOrder,
  summarizeSupermarketItems
} from '../../utils/supermarket-orders'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const body = await readBody(event)
  const supermarketName = assertSupermarketName(body?.supermarketName)

  return prisma.$transaction(async (tx) => {
    const items = await buildSupermarketItems(tx, body?.items)
    const adjustments = buildOrderAdjustments(body?.adjustments)
    const adjustmentRemark = parseOrderAdjustmentRemark(body?.adjustmentRemark ?? body?.remark)
    await deductSupermarketStock(tx, items)
    const totals = summarizeSupermarketItems(items)
    totals.totalAmount = Number((totals.totalAmount + sumOrderAdjustments(adjustments)).toFixed(2))

    const order = await tx.supermarketOrder.create({
      data: {
        orderNo: createSupermarketOrderNo(),
        supermarketName,
        staffId: staff.id,
        staffName: staff.name,
        adjustmentRemark,
        ...totals,
        items: { create: items.map(mapSupermarketItemForCreate) },
        adjustments: { create: adjustments.map(mapOrderAdjustment) }
      },
      include: { items: true, adjustments: true }
    })

    return mapSupermarketOrder(order)
  })
})
