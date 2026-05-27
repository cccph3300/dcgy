import type { Prisma, UnitType } from '@prisma/client'
import { createError } from 'h3'
import { formatDecimal, toMoney, toQuantity } from './number'

type Tx = Prisma.TransactionClient

export type IncomingOrderItem = {
  goodsId: number
  quantity: number
  weight: number
  price: number
  commission: number
}

export function createOrderNo() {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const time = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}${now.getMilliseconds()}`
  return `DD${yy}${mm}${dd}${time}`
}

export async function buildOrderItems(tx: Tx, rawItems: unknown) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '请至少选择一个商品' })
  }

  const items: IncomingOrderItem[] = rawItems.map((item: any) => ({
    goodsId: Number(item.goodsId),
    quantity: toQuantity(item.quantity, '数量'),
    weight: Number(item.weight || 0),
    price: toMoney(item.price, '价格'),
    commission: toMoney(item.commission, '佣金')
  }))

  const goodsList = await tx.goods.findMany({
    where: { id: { in: items.map(item => item.goodsId) }, enabled: true }
  })
  const goodsMap = new Map(goodsList.map(goods => [goods.id, goods]))

  return items.map(item => {
    const goods = goodsMap.get(item.goodsId)
    if (!goods) {
      throw createError({ statusCode: 400, statusMessage: '商品不存在或已停用' })
    }
    if (goods.unitType === 'weight' && item.weight <= 0) {
      throw createError({ statusCode: 400, statusMessage: `${goods.name}请填写重量` })
    }
    const costPrice = Number(goods.costPrice)
    const costAmount = goods.unitType === 'weight'
      ? item.weight * costPrice
      : item.quantity * costPrice
    const costCommission = Number(goods.defaultCommission || 0)
    const subtotal = goods.unitType === 'weight'
      ? Number((item.weight * item.price + item.quantity * item.commission).toFixed(2))
      : Number((item.quantity * item.price + item.quantity * item.commission).toFixed(2))
    const profit = Number((subtotal - costAmount - item.quantity * costCommission).toFixed(2))
    return {
      goods,
      quantity: item.quantity,
      weight: goods.unitType === 'weight' && item.weight > 0 ? Number(item.weight.toFixed(2)) : null,
      price: item.price,
      commission: item.commission,
      costCommission,
      subtotal,
      costPrice,
      profit
    }
  })
}

export async function deductStock(tx: Tx, items: Awaited<ReturnType<typeof buildOrderItems>>) {
  for (const item of items) {
    const currentStock = Number(item.goods.stock)
    if (currentStock < item.quantity) {
      throw createError({
        statusCode: 400,
        statusMessage: `${item.goods.name}库存仅剩${formatDecimal(item.goods.stock)}件`
      })
    }

    await tx.goods.update({
      where: { id: item.goods.id },
      data: { stock: { decrement: item.quantity } }
    })
  }
}

export async function restoreStock(tx: Tx, items: Array<{ goodsId: number, quantity: Prisma.Decimal | number }>) {
  for (const item of items) {
    await tx.goods.update({
      where: { id: item.goodsId },
      data: { stock: { increment: Number(item.quantity) } }
    })
  }
}

export function mapOrderItem(item: {
  goods: { id: number, name: string, unitType: UnitType },
  quantity: number,
  weight: number | null,
  price: number,
  commission: number,
  costCommission: number,
  subtotal: number,
  costPrice: number,
  profit: number
}) {
  return {
    goodsId: item.goods.id,
    goodsName: item.goods.name,
    unitType: item.goods.unitType,
    quantity: item.quantity,
    weight: item.weight,
    price: item.price,
    commission: item.commission,
    costCommission: item.costCommission,
    subtotal: item.subtotal,
    costPrice: item.costPrice,
    profit: item.profit
  }
}
