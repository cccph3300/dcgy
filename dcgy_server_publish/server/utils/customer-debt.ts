import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { formatDecimal } from './number'
import { formatOrderAdjustment } from './orders'

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true, adjustments: true } }>

type CustomerDebtOptions = {
  includeAllOrders?: boolean
}

function getOrderPartialPayment(order: OrderWithItems) {
  if (order.status === 'paid') return formatDecimal(order.totalAmount)
  if (order.status !== 'unpaid') return 0
  return formatDecimal(Math.min(Number(order.totalAmount || 0), Number(order.partialPayment || 0)))
}

function mapOrder(order: OrderWithItems) {
  const partialPayment = getOrderPartialPayment(order)
  const unpaidAmount = order.status === 'unpaid'
    ? formatDecimal(Math.max(Number(order.totalAmount || 0) - partialPayment, 0))
    : 0

  return {
    id: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    status: order.status,
    totalAmount: formatDecimal(order.totalAmount),
    partialPayment,
    paidAmount: partialPayment,
    unpaidAmount,
    profitAmount: formatDecimal(order.profitAmount),
    adjustmentRemark: order.adjustmentRemark || '',
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
    })),
    adjustments: order.adjustments.map(formatOrderAdjustment)
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
    include: {
      items: true,
      adjustments: { orderBy: { sortOrder: 'asc' } }
    }
  })

  const allOrders = includeAllOrders
    ? await prisma.order.findMany({
        where: {
          customerId
        },
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          adjustments: { orderBy: { sortOrder: 'asc' } }
        }
      })
    : []

  const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0)
  const profitAmount = orders.reduce((sum, order) => sum + Number(order.profitAmount), 0)
  const allocatedPartialPayment = formatDecimal(orders.reduce((sum, order) => {
    return sum + Math.min(Number(order.partialPayment || 0), Number(order.totalAmount || 0))
  }, 0))
  const availablePartialPayment = formatDecimal(Math.min(Number(customer.partialPayment || 0), Math.max(totalAmount - allocatedPartialPayment, 0)))
  const paidAmount = formatDecimal(Math.min(allocatedPartialPayment + availablePartialPayment, totalAmount))
  const unpaidAmount = Math.max(totalAmount - paidAmount, 0)

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      totalDebt: formatDecimal(totalAmount),
      partialPayment: paidAmount,
      allocatedPartialPayment,
      availablePartialPayment
    },
    totalAmount: formatDecimal(totalAmount),
    totalDebt: formatDecimal(totalAmount),
    partialPayment: paidAmount,
    allocatedPartialPayment,
    availablePartialPayment,
    unpaidAmount: formatDecimal(unpaidAmount),
    profitAmount: formatDecimal(profitAmount),
    orderCount: orders.length,
    allOrderCount: allOrders.length,
    orders: orders.map(mapOrder),
    allOrders: allOrders.map(mapOrder)
  }
}
