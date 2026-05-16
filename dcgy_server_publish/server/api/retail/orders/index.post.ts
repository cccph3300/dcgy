import { readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import {
  assertRetailCustomerName,
  buildRetailOrderItems,
  createRetailOrderNo,
  deductRetailStock,
  mapRetailOrder,
  mapRetailOrderItemForCreate,
  summarizeRetailItems
} from '../../../utils/retail'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const body = await readBody(event)
  const customerName = assertRetailCustomerName(body?.customerName)
  const customerPhone = String(body?.customerPhone || '').trim() || null
  const remark = String(body?.remark || '').trim() || null

  return prisma.$transaction(async (tx) => {
    const items = await buildRetailOrderItems(tx, body?.items)
    await deductRetailStock(tx, items)
    const totals = summarizeRetailItems(items)
    const order = await tx.retailOrder.create({
      data: {
        orderNo: createRetailOrderNo(),
        customerName,
        customerPhone,
        remark,
        staffId: staff.id,
        staffName: staff.name,
        ...totals,
        items: { create: items.map(mapRetailOrderItemForCreate) }
      },
      include: { items: true }
    })
    return mapRetailOrder(order)
  })
})
