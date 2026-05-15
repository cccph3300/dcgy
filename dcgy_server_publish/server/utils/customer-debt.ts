import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { formatDecimal } from './number'

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>

function mapOrder(order: OrderWithItems) {
  return {
    id: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    status: order.status,
    totalAmount: formatDecimal(order.totalAmount),
    profitAmount: formatDecimal(order.profitAmount),
    createdAt: order.createdAt,
    items: order.items.map(item => ({
      id: item.id,
      goodsName: item.goodsName,
      unitType: item.unitType,
      quantity: formatDecimal(item.quantity),
      weight: item.weight ? formatDecimal(item.weight) : null,
      price: formatDecimal(item.price),
      commission: formatDecimal(item.commission),
      subtotal: formatDecimal(item.subtotal),
      costPrice: formatDecimal(item.costPrice),
      profit: formatDecimal(item.profit)
    }))
  }
}

export async function getCustomerDebt(customerId: number) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true }
  })
  if (!customer) return null

  const orders = await prisma.order.findMany({
    where: {
      customerId,
      status: 'unpaid'
    },
    orderBy: { createdAt: 'desc' },
    include: { items: true }
  })

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const allOrders = await prisma.order.findMany({
    where: {
      customerId,
      createdAt: { gte: oneYearAgo }
    },
    orderBy: { createdAt: 'desc' },
    include: { items: true }
  })

  const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0)
  const profitAmount = orders.reduce((sum, order) => sum + Number(order.profitAmount), 0)

  return {
    customer,
    totalAmount: formatDecimal(totalAmount),
    profitAmount: formatDecimal(profitAmount),
    orderCount: orders.length,
    allOrderCount: allOrders.length,
    orders: orders.map(mapOrder),
    allOrders: allOrders.map(mapOrder)
  }
}
