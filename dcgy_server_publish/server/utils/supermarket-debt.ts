import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { formatDecimal } from './number'
import { formatOrderAdjustment } from './orders'
import { ensureSupermarketAccount, recalculateSupermarketDebt } from './supermarket-payments'

type SupermarketOrderWithItems = Prisma.SupermarketOrderGetPayload<{ include: { items: true, adjustments: true } }>

function getOrderPartialPayment(order: SupermarketOrderWithItems) {
  if (order.status === 'paid') return formatDecimal(order.totalAmount)
  if (order.status !== 'active') return 0
  return formatDecimal(Math.min(Number(order.totalAmount || 0), Number(order.partialPayment || 0)))
}

function mapOrder(order: SupermarketOrderWithItems) {
  const partialPayment = getOrderPartialPayment(order)
  const unpaidAmount = order.status === 'active'
    ? formatDecimal(Math.max(Number(order.totalAmount || 0) - partialPayment, 0))
    : 0

  return {
    id: order.id,
    orderNo: order.orderNo,
    supermarketName: order.supermarketName,
    status: order.status,
    totalAmount: formatDecimal(order.totalAmount),
    partialPayment,
    paidAmount: partialPayment,
    unpaidAmount,
    totalCost: formatDecimal(order.totalCost),
    totalCommission: formatDecimal(order.totalCommission),
    totalProfit: formatDecimal(order.totalProfit),
    adjustmentRemark: order.adjustmentRemark || '',
    itemCount: order.items.length,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map(item => ({
      id: item.id,
      type: item.type,
      goodsName: item.goodsName,
      unitType: item.unitType,
      quantity: formatDecimal(item.quantity),
      weight: item.weight ? formatDecimal(item.weight) : null,
      price: formatDecimal(item.price),
      commission: formatDecimal(item.commission),
      subtotal: formatDecimal(item.subtotal)
    })),
    adjustments: order.adjustments.map(formatOrderAdjustment)
  }
}

export async function getSupermarketDebt(name: string) {
  const supermarketName = String(name || '').trim()
  if (!supermarketName) return null

  await recalculateSupermarketDebt(supermarketName)
  const account = await ensureSupermarketAccount(supermarketName)
  const [orders, allOrders] = await Promise.all([
    prisma.supermarketOrder.findMany({
      where: {
        supermarketName,
        status: 'active'
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        adjustments: { orderBy: { sortOrder: 'asc' } }
      }
    }),
    prisma.supermarketOrder.findMany({
      where: {
        supermarketName
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        adjustments: { orderBy: { sortOrder: 'asc' } }
      }
    })
  ])

  const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
  const totalCost = orders.reduce((sum, order) => sum + Number(order.totalCost || 0), 0)
  const totalCommission = orders.reduce((sum, order) => sum + Number(order.totalCommission || 0), 0)
  const totalProfit = orders.reduce((sum, order) => sum + Number(order.totalProfit || 0), 0)
  const allocatedPartialPayment = formatDecimal(orders.reduce((sum, order) => {
    return sum + Math.min(Number(order.partialPayment || 0), Number(order.totalAmount || 0))
  }, 0))
  const availablePartialPayment = formatDecimal(Math.min(Number(account.partialPayment || 0), Math.max(totalAmount - allocatedPartialPayment, 0)))
  const paidAmount = formatDecimal(Math.min(allocatedPartialPayment + availablePartialPayment, totalAmount))
  const unpaidAmount = Math.max(totalAmount - paidAmount, 0)

  return {
    supermarket: {
      id: account.id,
      name: supermarketName,
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
    totalCost: formatDecimal(totalCost),
    totalCommission: formatDecimal(totalCommission),
    totalProfit: formatDecimal(totalProfit),
    orderCount: orders.length,
    allOrderCount: allOrders.length,
    orders: orders.map(mapOrder),
    allOrders: allOrders.map(mapOrder)
  }
}
