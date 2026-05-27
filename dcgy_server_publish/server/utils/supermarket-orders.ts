import type { Prisma, SupermarketItemType, UnitType } from '@prisma/client'
import { createError } from 'h3'
import { assertName, formatDecimal, toMoney, toQuantity } from './number'

type Tx = Prisma.TransactionClient
type SupermarketOrderWithItems = Prisma.SupermarketOrderGetPayload<{ include: { items: true } }>

type IncomingSupermarketItem = {
  type: SupermarketItemType
  goodsId: number
  goodsName: string
  quantity: number
  weight: number
  price: number
  commission: number
  costPrice: number | null
}

type BuiltSupermarketItem = {
  type: SupermarketItemType
  goodsId: number | null
  goodsName: string
  unitType: UnitType
  quantity: number
  weight: number | null
  price: number
  commission: number
  costCommission: number
  costPrice: number
  subtotal: number
  costAmount: number
  profit: number
  stockGoods?: {
    id: number
    name: string
    stock: Prisma.Decimal
  }
}

export function createSupermarketOrderNo() {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const time = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}${now.getMilliseconds()}`
  return `SM${yy}${mm}${dd}${time}`
}

export function assertSupermarketName(value: unknown) {
  const name = assertName(value, '超市名称')
  if (name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: '超市名称不能超过80个字' })
  }
  return name
}

function parseType(value: unknown): SupermarketItemType {
  if (value === 'own' || value === 'purchase') return value
  throw createError({ statusCode: 400, statusMessage: '明细类型必须是own或purchase' })
}

function parseWeight(value: unknown) {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num) || num < 0) {
    throw createError({ statusCode: 400, statusMessage: '重量必须是非负数字' })
  }
  return Number(num.toFixed(2))
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function calcItemAmount(unitType: UnitType, quantity: number, weight: number | null, price: number, commission: number, costPrice: number, costCommission: number) {
  const billingAmount = unitType === 'weight' ? Number(weight || 0) : quantity
  const subtotal = roundMoney(billingAmount * price + quantity * commission)
  const costAmount = roundMoney(billingAmount * costPrice)
  const profit = roundMoney(subtotal - costAmount - quantity * costCommission)
  return { subtotal, costAmount, profit }
}

export async function buildSupermarketItems(tx: Tx, rawItems: unknown): Promise<BuiltSupermarketItem[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '请至少填写一条商品明细' })
  }

  const incomingItems: IncomingSupermarketItem[] = rawItems.map((item: any) => ({
    type: parseType(item?.type),
    goodsId: Number(item?.goodsId || 0),
    goodsName: String(item?.goodsName ?? '').trim(),
    quantity: toQuantity(item?.quantity, '数量'),
    weight: parseWeight(item?.weight),
    price: toMoney(item?.price, '价格'),
    commission: toMoney(item?.commission, '佣金'),
    costPrice: item?.costPrice === undefined || item?.costPrice === null || item?.costPrice === ''
      ? null
      : toMoney(item.costPrice, '成本价')
  }))

  const ownGoodsIds = incomingItems
    .filter(item => item.type === 'own')
    .map(item => item.goodsId)

  const goodsList = ownGoodsIds.length
    ? await tx.goods.findMany({ where: { id: { in: ownGoodsIds }, enabled: true } })
    : []
  const goodsMap = new Map(goodsList.map(goods => [goods.id, goods]))

  return incomingItems.map(item => {
    if (item.type === 'own') {
      if (!Number.isFinite(item.goodsId) || item.goodsId <= 0) {
        throw createError({ statusCode: 400, statusMessage: '自家商品必须选择库存商品' })
      }
      const goods = goodsMap.get(item.goodsId)
      if (!goods) {
        throw createError({ statusCode: 400, statusMessage: '自家商品不存在或已停用' })
      }
      if (goods.unitType === 'weight' && item.weight <= 0) {
        throw createError({ statusCode: 400, statusMessage: `${goods.name}请填写重量` })
      }
      const goodsName = item.goodsName ? assertName(item.goodsName, '商品名称') : goods.name
      const costPrice = item.costPrice ?? Number(goods.costPrice)
      const costCommission = Number(goods.defaultCommission || 0)
      const weight = goods.unitType === 'weight' ? item.weight : null
      const amounts = calcItemAmount(goods.unitType, item.quantity, weight, item.price, item.commission, costPrice, costCommission)
      return {
        type: item.type,
        goodsId: goods.id,
        goodsName,
        unitType: goods.unitType,
        quantity: item.quantity,
        weight,
        price: item.price,
        commission: item.commission,
        costCommission,
        costPrice,
        ...amounts,
        stockGoods: goods
      }
    }

    const goodsName = assertName(item.goodsName, '商品名称')
    const costPrice = item.costPrice ?? 0
    const costCommission = 0
    const unitType: UnitType = item.weight > 0 ? 'weight' : 'qty'
    const weight = item.weight > 0 ? item.weight : null
    const amounts = calcItemAmount(unitType, item.quantity, weight, item.price, item.commission, costPrice, costCommission)
    return {
      type: item.type,
      goodsId: null,
      goodsName,
      unitType,
      quantity: item.quantity,
      weight,
      price: item.price,
      commission: item.commission,
      costCommission,
      costPrice,
      ...amounts
    }
  })
}

export function summarizeSupermarketItems(items: BuiltSupermarketItem[]) {
  return {
    totalAmount: roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0)),
    totalCost: roundMoney(items.reduce((sum, item) => sum + item.costAmount, 0)),
    totalCommission: roundMoney(items.reduce((sum, item) => sum + item.quantity * item.commission, 0)),
    totalProfit: roundMoney(items.reduce((sum, item) => sum + item.profit, 0))
  }
}

export async function deductSupermarketStock(tx: Tx, items: BuiltSupermarketItem[]) {
  for (const item of items) {
    if (item.type !== 'own' || !item.stockGoods) continue
    const currentStock = Number(item.stockGoods.stock)
    if (currentStock < item.quantity) {
      throw createError({
        statusCode: 400,
        statusMessage: `${item.goodsName}库存仅剩${formatDecimal(item.stockGoods.stock)}件`
      })
    }
    await tx.goods.update({
      where: { id: item.stockGoods.id },
      data: { stock: { decrement: item.quantity } }
    })
  }
}

export async function restoreSupermarketStock(tx: Tx, items: Array<{ type: SupermarketItemType, goodsId: number | null, quantity: Prisma.Decimal | number }>) {
  for (const item of items) {
    if (item.type !== 'own' || !item.goodsId) continue
    await tx.goods.update({
      where: { id: item.goodsId },
      data: { stock: { increment: Number(item.quantity) } }
    })
  }
}

export function mapSupermarketItemForCreate(item: BuiltSupermarketItem) {
  return {
    type: item.type,
    goodsId: item.goodsId,
    goodsName: item.goodsName,
    unitType: item.unitType,
    quantity: item.quantity,
    weight: item.weight,
    price: item.price,
    commission: item.commission,
    costCommission: item.costCommission,
    costPrice: item.costPrice,
    subtotal: item.subtotal,
    costAmount: item.costAmount,
    profit: item.profit
  }
}

export function mapSupermarketOrder(order: SupermarketOrderWithItems) {
  return {
    id: order.id,
    orderNo: order.orderNo,
    supermarketName: order.supermarketName,
    staffName: order.staffName,
    status: order.status,
    totalAmount: formatDecimal(order.totalAmount),
    totalCost: formatDecimal(order.totalCost),
    totalCommission: formatDecimal(order.totalCommission),
    totalProfit: formatDecimal(order.totalProfit),
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map(item => ({
      id: item.id,
      type: item.type,
      goodsId: item.goodsId,
      goodsName: item.goodsName,
      unitType: item.unitType,
      quantity: formatDecimal(item.quantity),
      weight: item.weight ? formatDecimal(item.weight) : null,
      price: formatDecimal(item.price),
      commission: formatDecimal(item.commission),
      costCommission: formatDecimal(item.costCommission || 0),
      costPrice: formatDecimal(item.costPrice),
      subtotal: formatDecimal(item.subtotal),
      costAmount: formatDecimal(item.costAmount),
      profit: formatDecimal(item.profit)
    }))
  }
}

export function mapSupermarketSheet(order: SupermarketOrderWithItems) {
  const mapped = mapSupermarketOrder(order)
  return {
    title: `${mapped.supermarketName}送货单`,
    supermarketName: mapped.supermarketName,
    orderNo: mapped.orderNo,
    columns: ['水果名称', '数量', '重量', '价格', '佣金', '总价'],
    rows: mapped.items.map(item => ({
      goodsName: item.goodsName,
      quantity: item.quantity,
      weight: item.weight,
      price: item.price,
      commission: item.commission,
      total: item.subtotal,
      type: item.type,
      unitType: item.unitType
    })),
    totalAmount: mapped.totalAmount,
    totalCost: mapped.totalCost,
    totalCommission: mapped.totalCommission,
    totalProfit: mapped.totalProfit,
    filledAt: mapped.createdAt
  }
}
