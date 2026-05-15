import { readBody } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
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
    await deductSupermarketStock(tx, items)
    const totals = summarizeSupermarketItems(items)

    const order = await tx.supermarketOrder.create({
      data: {
        orderNo: createSupermarketOrderNo(),
        supermarketName,
        staffId: staff.id,
        staffName: staff.name,
        ...totals,
        items: { create: items.map(mapSupermarketItemForCreate) }
      },
      include: { items: true }
    })

    return mapSupermarketOrder(order)
  })
})
