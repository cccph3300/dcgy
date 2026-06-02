import { createError, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireStaff } from '../../utils/auth'
import { assertName } from '../../utils/number'
import {
  buildOrderAdjustments,
  buildOrderItems,
  deductStock,
  mapOrderAdjustment,
  mapOrderItem,
  parseOrderAdjustmentRemark,
  restoreStock,
  sumOrderAdjustments
} from '../../utils/orders'
import { recalculateCustomerDebt } from '../../utils/customer-payments'
import { parseChinaDateTime } from '../../utils/date-query'

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
    if (order.status !== 'unpaid' && order.status !== 'paid' && order.status !== 'cancelled') {
      throw createError({ statusCode: 400, statusMessage: '订单状态不允许修改' })
    }

    if (order.status !== 'cancelled') {
      await restoreStock(tx, order.items)
    }

    const customer = await tx.customer.upsert({
      where: { name: customerName },
      update: {},
      create: { name: customerName }
    })
    const items = await buildOrderItems(tx, body?.items)
    const adjustments = buildOrderAdjustments(body?.adjustments)
    const adjustmentRemark = parseOrderAdjustmentRemark(body?.adjustmentRemark ?? body?.remark)
    if (order.status !== 'cancelled') {
      await deductStock(tx, items)
    }

    await tx.orderItem.deleteMany({ where: { orderId: id } })
    await tx.orderAdjustment.deleteMany({ where: { orderId: id } })

    const goodsAmount = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
    const commission = Number(items.reduce((sum, item) => sum + item.quantity * item.commission, 0).toFixed(2))
    const profitAmount = Number(items.reduce((sum, item) => sum + item.profit, 0).toFixed(2))
    const totalAmount = Number((goodsAmount + sumOrderAdjustments(adjustments)).toFixed(2))
    if (totalAmount < 0) {
      throw createError({ statusCode: 400, statusMessage: '订单总金额不能小于0' })
    }

    const updatedOrder = await tx.order.update({
      where: { id },
      data: {
        customerId: customer.id,
        customerName,
        goodsAmount,
        commission,
        totalAmount,
        profitAmount,
        adjustmentRemark,
        ...(body?.createdDate ? { createdAt: parseChinaDateTime(body.createdDate, body.createdTime || '00:00') } : {}),
        items: { create: items.map(mapOrderItem) },
        adjustments: { create: adjustments.map(mapOrderAdjustment) }
      },
      include: { items: true, adjustments: true }
    })
    await recalculateCustomerDebt(order.customerId, tx)
    if (customer.id !== order.customerId) {
      await recalculateCustomerDebt(customer.id, tx)
    }
    return updatedOrder
  })
})
