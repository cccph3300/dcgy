import { getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { formatDecimal } from '../../utils/number'
import { dateRangeFromQuery } from '../../utils/print-record-query'
import { RETAIL_CATEGORY_LABELS } from '../../utils/retail'
import { prisma } from '../../utils/prisma'

function quantityText(unitType: string, quantity: number, weight: number) {
  const quantityPart = `${formatDecimal(quantity)}件`
  return unitType === 'weight' && weight > 0
    ? `${quantityPart} ${formatDecimal(weight)}斤`
    : quantityPart
}

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const createdAt = dateRangeFromQuery(query)
  const where = Object.keys(createdAt).length ? { createdAt } : {}

  const orders = await prisma.retailOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: true }
  })

  const goodsMap = new Map<string, {
    key: string
    goodsName: string
    categoryText: string
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

  function addGoodsRow(key: string, goodsName: string, categoryText: string, unitType: string, quantity: number, weight: number, salesAmount: number, costAmount: number, profitAmount: number) {
    const current = goodsMap.get(key) || {
      key,
      goodsName,
      categoryText,
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
    const costAmount = Number(order.totalCost)
    const profitAmount = Number(order.totalProfit)
    totalSales += salesAmount
    totalCost += costAmount
    totalProfit += profitAmount
    orderRows.push({
      key: `retail-${order.id}`,
      id: order.id,
      name: order.customerName,
      typeText: order.status === 'paid' ? '已付' : '未付',
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
      addGoodsRow(
        `${item.productId}-${item.unitType}`,
        item.goodsName,
        RETAIL_CATEGORY_LABELS[item.category],
        item.unitType,
        quantity,
        weight,
        sales,
        cost,
        profit
      )
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

  return {
    summary: {
      sales: formatDecimal(totalSales),
      cost: formatDecimal(totalCost),
      profit: formatDecimal(totalProfit),
      orderCount: orders.length
    },
    goodsRows,
    orderRows
  }
})
