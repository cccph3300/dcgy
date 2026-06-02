import { createError } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'
import { formatOrderAdjustment } from '../../utils/orders'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      adjustments: { orderBy: { sortOrder: 'asc' } }
    }
  })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: '订单不存在' })
  }

  return {
    id: order.id,
    orderNo: order.orderNo,
    customerId: order.customerId,
    customerName: order.customerName,
    staffName: order.staffName,
    status: order.status,
    goodsAmount: formatDecimal(order.goodsAmount),
    commission: formatDecimal(order.commission),
    totalAmount: formatDecimal(order.totalAmount),
    profitAmount: formatDecimal(order.profitAmount),
    adjustmentRemark: order.adjustmentRemark || '',
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    items: order.items.map(item => ({
      id: item.id,
      goodsId: item.goodsId,
      goodsName: item.goodsName,
      unitType: item.unitType,
      quantity: formatDecimal(item.quantity),
      weight: item.weight ? formatDecimal(item.weight) : null,
      price: formatDecimal(item.price),
      commission: formatDecimal(item.commission),
      costCommission: formatDecimal(item.costCommission || 0),
      subtotal: formatDecimal(item.subtotal),
      costPrice: formatDecimal(item.costPrice),
      profit: formatDecimal(item.profit)
    })),
    adjustments: order.adjustments.map(formatOrderAdjustment)
  }
})
