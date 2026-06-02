import { getQuery } from 'h3'
import { requireStaff } from '../utils/auth'
import { dateWhereFromQuery } from '../utils/date-query'
import { formatDecimal } from '../utils/number'
import { prisma } from '../utils/prisma'

function calcCostCommission(items: Array<{ quantity: unknown, costCommission: unknown }>) {
  return items.reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.costCommission || 0)
  }, 0)
}

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const createdAt = dateWhereFromQuery(query)
  const dateWhere = Object.keys(createdAt).length ? { createdAt } : {}

  const orders = await prisma.supermarketOrder.findMany({
    where: {
      ...dateWhere,
      status: { not: 'cancelled' }
    },
    orderBy: { createdAt: 'desc' },
    include: { items: true }
  })

  let totalCost = 0
  let totalCostCommission = 0
  let totalSaleCommission = 0
  let totalProfit = 0

  const rows = orders.map((order) => {
    const cost = Number(order.totalCost || 0)
    const costCommission = calcCostCommission(order.items)
    const saleCommission = Number(order.totalCommission || 0)
    const profit = Number(order.totalProfit || 0)

    totalCost += cost
    totalCostCommission += costCommission
    totalSaleCommission += saleCommission
    totalProfit += profit

    return {
      key: `supermarket-${order.id}`,
      id: order.id,
      supermarketName: order.supermarketName,
      orderNo: order.orderNo,
      status: order.status,
      itemCount: order.items.length,
      totalAmount: formatDecimal(order.totalAmount),
      totalCost: formatDecimal(cost),
      totalCostCommission: formatDecimal(costCommission),
      totalSaleCommission: formatDecimal(saleCommission),
      totalProfit: formatDecimal(profit),
      createdAt: order.createdAt
    }
  })

  return {
    summary: {
      totalCost: formatDecimal(totalCost),
      totalCostCommission: formatDecimal(totalCostCommission),
      totalSaleCommission: formatDecimal(totalSaleCommission),
      totalProfit: formatDecimal(totalProfit),
      orderCount: orders.length
    },
    rows
  }
})
