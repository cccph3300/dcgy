import { createError, getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'

function oneYearAgo() {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 1)
  return date
}

function mapOrder(order: {
  id: number
  orderNo: string
  supermarketName: string
  status: string
  totalAmount: unknown
  totalCost: unknown
  totalCommission: unknown
  totalProfit: unknown
  createdAt: Date
  updatedAt: Date
  items: Array<{ id: number }>
}) {
  return {
    id: order.id,
    orderNo: order.orderNo,
    supermarketName: order.supermarketName,
    status: order.status,
    totalAmount: formatDecimal(order.totalAmount),
    totalCost: formatDecimal(order.totalCost),
    totalCommission: formatDecimal(order.totalCommission),
    totalProfit: formatDecimal(order.totalProfit),
    itemCount: order.items.length,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  }
}

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const name = String(getQuery(event).name ?? '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '请传入超市名称' })
  }

  const [orders, allOrders] = await Promise.all([
    prisma.supermarketOrder.findMany({
      where: {
        supermarketName: name,
        status: 'active'
      },
      orderBy: { createdAt: 'desc' },
      include: { items: { select: { id: true } } }
    }),
    prisma.supermarketOrder.findMany({
      where: {
        supermarketName: name,
        createdAt: { gte: oneYearAgo() }
      },
      orderBy: { createdAt: 'desc' },
      include: { items: { select: { id: true } } }
    })
  ])

  const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
  const totalCost = orders.reduce((sum, order) => sum + Number(order.totalCost || 0), 0)
  const totalCommission = orders.reduce((sum, order) => sum + Number(order.totalCommission || 0), 0)
  const totalProfit = orders.reduce((sum, order) => sum + Number(order.totalProfit || 0), 0)

  return {
    supermarket: {
      name
    },
    totalAmount: formatDecimal(totalAmount),
    totalCost: formatDecimal(totalCost),
    totalCommission: formatDecimal(totalCommission),
    totalProfit: formatDecimal(totalProfit),
    orderCount: orders.length,
    allOrderCount: allOrders.length,
    orders: orders.map(mapOrder),
    allOrders: allOrders.map(mapOrder)
  }
})
