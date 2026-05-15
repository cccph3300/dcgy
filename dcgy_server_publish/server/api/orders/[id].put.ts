import { createError, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireStaff } from '../../utils/auth'
import { assertName, toMoney } from '../../utils/number'
import { buildOrderItems, deductStock, mapOrderItem, restoreStock } from '../../utils/orders'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const customerName = assertName(body?.customerName, '客户名')

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { items: true }
    })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '订单不存在' })
    }
    if (order.status !== 'unpaid' && order.status !== 'cancelled') {
      throw createError({ statusCode: 400, statusMessage: '只有未付或已毁单订单可以修改' })
    }

    if (order.status === 'unpaid') {
      await restoreStock(tx, order.items)
    }

    const customer = await tx.customer.upsert({
      where: { name: customerName },
      update: {},
      create: { name: customerName }
    })
    const items = await buildOrderItems(tx, body?.items)
    if (order.status === 'unpaid') {
      await deductStock(tx, items)
    }

    await tx.orderItem.deleteMany({ where: { orderId: id } })

    const goodsAmount = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
    const commission = Number(items.reduce((sum, item) => sum + item.commission, 0).toFixed(2))
    const profitAmount = Number(items.reduce((sum, item) => sum + item.profit, 0).toFixed(2))
    const totalAmount = goodsAmount

    return tx.order.update({
      where: { id },
      data: {
        customerId: customer.id,
        customerName,
        goodsAmount,
        commission,
        totalAmount,
        profitAmount,
        items: { create: items.map(mapOrderItem) }
      },
      include: { items: true }
    })
  })
})
