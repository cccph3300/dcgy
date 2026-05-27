import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { formatDecimal } from './number'

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>

type CustomerDebtOptions = {
  includeAllOrders?: boolean
}

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
      costCommission: formatDecimal(item.costCommission || 0),
      subtotal: formatDecimal(item.subtotal),
      costPrice: formatDecimal(item.costPrice),
      profit: formatDecimal(item.profit)
    }))
  }
}

export async function getCustomerDebt(customerId: number, options: CustomerDebtOptions = {}) {
  const includeAllOrders = options.includeAllOrders !== false
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, totalDebt: true, partialPayment: true }
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

  const allOrders = includeAllOrders
    ? await prisma.order.findMany({
        where: {
          customerId,
          createdAt: { gte: oneYearAgo() }
        },
        orderBy: { createdAt: 'desc' },
        include: { items: true }
      })
    : []

  const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0)
  const profitAmount = orders.reduce((sum, order) => sum + Number(order.profitAmount), 0)
  const partialPayment = Math.min(Number(customer.partialPayment || 0), totalAmount)
  const unpaidAmount = Math.max(totalAmount - partialPayment, 0)

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      totalDebt: formatDecimal(totalAmount),
      partialPayment: formatDecimal(partialPayment)
    },
    totalAmount: formatDecimal(totalAmount),
    totalDebt: formatDecimal(totalAmount),
    partialPayment: formatDecimal(partialPayment),
    unpaidAmount: formatDecimal(unpaidAmount),
    profitAmount: formatDecimal(profitAmount),
    orderCount: orders.length,
    allOrderCount: allOrders.length,
    orders: orders.map(mapOrder),
    allOrders: allOrders.map(mapOrder)
  }
}

function oneYearAgo() {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 1)
  return date
}
