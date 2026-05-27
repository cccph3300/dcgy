import { getQuery } from 'h3'
import { requireStaff } from '../utils/auth'
import { dateWhereFromQuery } from '../utils/date-query'
import { formatDecimal } from '../utils/number'
import { prisma } from '../utils/prisma'

function quantityText(unitType: string, quantity: number, weight: number) {
  const quantityPart = `${formatDecimal(quantity)}件`
  return unitType === 'weight' && weight > 0
    ? `${quantityPart} ${formatDecimal(weight)}斤`
    : quantityPart
}

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const createdAt = dateWhereFromQuery(query)
  const dateWhere = Object.keys(createdAt).length ? { createdAt } : {}

  const [orders, supermarketOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...dateWhere,
        status: { not: 'cancelled' }
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    }),
    prisma.supermarketOrder.findMany({
      where: {
        ...dateWhere,
        status: { not: 'cancelled' }
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    })
  ])

  const goodsMap = new Map<string, {
    key: string
    goodsName: string
    unitType: string
    quantity: number
    weight: number
    salesAmount: number
    costAmount: number
    profitAmount: number
  }>()
  const orderRows: Array<Record<string, unknown>> = []
  let totalSales = 0
  let totalCost = 0
  let totalProfit = 0

  function addGoodsRow(key: string, goodsName: string, unitType: string, quantity: number, weight: number, salesAmount: number, costAmount: number, profitAmount: number) {
    const current = goodsMap.get(key) || {
      key,
      goodsName,
      unitType,
      quantity: 0,
      weight: 0,
      salesAmount: 0,
      costAmount: 0,
      profitAmount: 0
    }
    current.quantity += quantity
    current.weight += weight
    current.salesAmount += salesAmount
    current.costAmount += costAmount
    current.profitAmount += profitAmount
    goodsMap.set(key, current)
  }

  for (const order of orders) {
    const salesAmount = Number(order.totalAmount)
    const profitAmount = Number(order.profitAmount)
    const costAmount = salesAmount - profitAmount
    totalSales += salesAmount
    totalCost += costAmount
    totalProfit += profitAmount
    orderRows.push({
      key: `order-${order.id}`,
      id: order.id,
      source: 'order',
      name: order.customerName,
      typeText: '普通订单',
      createdAt: order.createdAt,
      salesAmount: formatDecimal(salesAmount),
      costAmount: formatDecimal(costAmount),
      profitAmount: formatDecimal(profitAmount)
    })

    for (const item of order.items) {
      const quantity = Number(item.quantity)
      const weight = item.weight ? Number(item.weight) : 0
      const sales = Number(item.subtotal)
      const baseCost = item.unitType === 'weight' && weight > 0
        ? weight * Number(item.costPrice)
        : quantity * Number(item.costPrice)
      const cost = baseCost + quantity * Number(item.costCommission || 0)
      const profit = item.profit === null || item.profit === undefined
        ? sales - cost
        : Number(item.profit)
      addGoodsRow(`${item.goodsId}-${item.unitType}`, item.goodsName, item.unitType, quantity, weight, sales, cost, profit)
    }
  }

  for (const order of supermarketOrders) {
    const salesAmount = Number(order.totalAmount)
    const costAmount = Number(order.totalCost)
    const profitAmount = Number(order.totalProfit)
    totalSales += salesAmount
    totalCost += costAmount
    totalProfit += profitAmount
    orderRows.push({
      key: `supermarket-${order.id}`,
      id: order.id,
      source: 'supermarket',
      name: order.supermarketName,
      typeText: '超市配送',
      createdAt: order.createdAt,
      salesAmount: formatDecimal(salesAmount),
      costAmount: formatDecimal(costAmount),
      profitAmount: formatDecimal(profitAmount)
    })

    for (const item of order.items) {
      const quantity = Number(item.quantity)
      const weight = item.weight ? Number(item.weight) : 0
      const sales = Number(item.subtotal)
      const cost = Number(item.costAmount)
      const profit = Number(item.profit)
      addGoodsRow(`supermarket-${item.goodsId || item.goodsName}-${item.unitType}`, item.goodsName, item.unitType, quantity, weight, sales, cost, profit)
    }
  }

  const goodsRows = Array.from(goodsMap.values()).map(row => ({
    ...row,
    quantity: formatDecimal(row.quantity),
    weight: formatDecimal(row.weight),
    salesAmount: formatDecimal(row.salesAmount),
    costAmount: formatDecimal(row.costAmount),
    profitAmount: formatDecimal(row.profitAmount),
    quantityText: quantityText(row.unitType, row.quantity, row.weight)
  }))

  orderRows.sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())

  return {
    summary: {
      sales: formatDecimal(totalSales),
      cost: formatDecimal(totalCost),
      profit: formatDecimal(totalProfit),
      orderCount: orders.length + supermarketOrders.length
    },
    goodsRows,
    orderRows
  }
})
