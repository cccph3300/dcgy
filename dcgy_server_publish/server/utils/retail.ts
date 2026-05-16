import type { Prisma, RetailCategory, RetailProductSource, UnitType } from '@prisma/client'
import { createError } from 'h3'
import { assertName, formatDecimal, toMoney, toQuantity } from './number'

type Tx = Prisma.TransactionClient
type RetailProductWithGoods = Prisma.RetailProductGetPayload<{ include: { goods: true } }>
type RetailOrderWithItems = Prisma.RetailOrderGetPayload<{ include: { items: true } }>

export const RETAIL_CATEGORIES: RetailCategory[] = ['special', 'imported', 'domestic', 'gift', 'dry']
export const RETAIL_CATEGORY_LABELS: Record<RetailCategory, string> = {
  special: '特价',
  imported: '进口果',
  domestic: '国产果',
  gift: '礼盒装',
  dry: '干货'
}

const CATEGORY_SORT = new Map(RETAIL_CATEGORIES.map((category, index) => [category, index]))

export function createRetailOrderNo() {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const time = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}${now.getMilliseconds()}`
  return `RT${yy}${mm}${dd}${time}`
}

export function parseRetailCategory(value: unknown): RetailCategory {
  if (RETAIL_CATEGORIES.includes(value as RetailCategory)) return value as RetailCategory
  throw createError({ statusCode: 400, statusMessage: '零售种类不正确' })
}

export function parseRetailSource(value: unknown): RetailProductSource {
  if (value === 'stock' || value === 'consignment') return value
  throw createError({ statusCode: 400, statusMessage: '商品来源必须是库存或代卖' })
}

export function parseUnitType(value: unknown): UnitType {
  if (value === 'weight' || value === 'qty') return value
  throw createError({ statusCode: 400, statusMessage: '计价方式不正确' })
}

export function categorySort(category: RetailCategory) {
  return CATEGORY_SORT.get(category) ?? 99
}

export function mapRetailProduct(product: RetailProductWithGoods) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    category: product.category,
    categoryText: RETAIL_CATEGORY_LABELS[product.category],
    sourceType: product.sourceType,
    goodsId: product.goodsId,
    goodsName: product.goods?.name || '',
    stock: product.goods ? formatDecimal(product.goods.stock) : null,
    unitType: product.unitType,
    price: formatDecimal(product.price),
    costPrice: formatDecimal(product.costPrice),
    commission: formatDecimal(product.commission),
    imageUrl: product.imageUrl,
    sortOrder: product.sortOrder,
    enabled: product.enabled,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  }
}

export function mapPublicRetailProduct(product: RetailProductWithGoods) {
  const mapped = mapRetailProduct(product)
  return {
    id: mapped.id,
    name: mapped.name,
    description: mapped.description,
    category: mapped.category,
    categoryText: mapped.categoryText,
    unitType: mapped.unitType,
    price: mapped.price,
    commission: mapped.commission,
    imageUrl: mapped.imageUrl
  }
}

export async function imageDataUrlFromLocalPath(imageUrl: string | null) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/retail/')) return ''
  const { readFile } = await import('node:fs/promises')
  const { extname, join, basename } = await import('node:path')
  const filename = basename(imageUrl)
  if (!/^[a-zA-Z0-9.-]+$/.test(filename)) return ''
  const ext = extname(filename).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  try {
    const buffer = await readFile(join(process.cwd(), 'uploads', 'retail', filename))
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return ''
  }
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function parseWeight(value: unknown) {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num) || num < 0) {
    throw createError({ statusCode: 400, statusMessage: '重量必须是非负数字' })
  }
  return Number(num.toFixed(2))
}

type BuiltRetailItem = {
  product: RetailProductWithGoods
  quantity: number
  weight: number | null
  subtotal: number
  costAmount: number
  profit: number
}

export async function buildRetailOrderItems(tx: Tx, rawItems: unknown): Promise<BuiltRetailItem[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '请至少选择一个零售商品' })
  }

  const incoming = rawItems.map((item: any) => ({
    productId: Number(item?.productId || 0),
    quantity: toQuantity(item?.quantity, '数量'),
    weight: parseWeight(item?.weight)
  }))
  const products = await tx.retailProduct.findMany({
    where: { id: { in: incoming.map(item => item.productId) }, enabled: true },
    include: { goods: true }
  })
  const productMap = new Map(products.map(product => [product.id, product]))

  return incoming.map(item => {
    const product = productMap.get(item.productId)
    if (!product) {
      throw createError({ statusCode: 400, statusMessage: '零售商品不存在或已下架' })
    }
    if (product.unitType === 'weight' && item.weight <= 0) {
      throw createError({ statusCode: 400, statusMessage: `${product.name}请填写重量` })
    }
    if (product.sourceType === 'stock') {
      if (!product.goods) {
        throw createError({ statusCode: 400, statusMessage: `${product.name}未关联库存商品` })
      }
      const currentStock = Number(product.goods.stock)
      if (currentStock < item.quantity) {
        throw createError({ statusCode: 400, statusMessage: `${product.name}库存仅剩${formatDecimal(product.goods.stock)}件` })
      }
    }
    const billingAmount = product.unitType === 'weight' ? item.weight : item.quantity
    const subtotal = roundMoney(billingAmount * Number(product.price) + Number(product.commission))
    const costAmount = roundMoney(billingAmount * Number(product.costPrice))
    const profit = roundMoney(subtotal - costAmount - Number(product.commission))
    return {
      product,
      quantity: item.quantity,
      weight: product.unitType === 'weight' ? item.weight : null,
      subtotal,
      costAmount,
      profit
    }
  })
}

export async function deductRetailStock(tx: Tx, items: BuiltRetailItem[]) {
  for (const item of items) {
    if (item.product.sourceType !== 'stock' || !item.product.goodsId) continue
    await tx.goods.update({
      where: { id: item.product.goodsId },
      data: { stock: { decrement: item.quantity } }
    })
  }
}

export function summarizeRetailItems(items: BuiltRetailItem[]) {
  return {
    totalAmount: roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0)),
    totalCost: roundMoney(items.reduce((sum, item) => sum + item.costAmount, 0)),
    totalProfit: roundMoney(items.reduce((sum, item) => sum + item.profit, 0)),
    totalCommission: roundMoney(items.reduce((sum, item) => sum + Number(item.product.commission), 0))
  }
}

export function mapRetailOrderItemForCreate(item: BuiltRetailItem) {
  const product = item.product
  return {
    productId: product.id,
    sourceType: product.sourceType,
    goodsId: product.goodsId,
    goodsName: product.name,
    category: product.category,
    unitType: product.unitType,
    quantity: item.quantity,
    weight: item.weight,
    price: product.price,
    costPrice: product.costPrice,
    costAmount: item.costAmount,
    profit: item.profit,
    commission: product.commission,
    subtotal: item.subtotal,
    imageUrl: product.imageUrl
  }
}

export function mapRetailOrder(order: RetailOrderWithItems) {
  return {
    id: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    remark: order.remark,
    staffName: order.staffName,
    status: order.status,
    totalAmount: formatDecimal(order.totalAmount),
    totalCost: formatDecimal(order.totalCost),
    totalProfit: formatDecimal(order.totalProfit),
    totalCommission: formatDecimal(order.totalCommission),
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map(item => ({
      id: item.id,
      productId: item.productId,
      sourceType: item.sourceType,
      goodsId: item.goodsId,
      goodsName: item.goodsName,
      category: item.category,
      categoryText: RETAIL_CATEGORY_LABELS[item.category],
      unitType: item.unitType,
      quantity: formatDecimal(item.quantity),
      weight: item.weight ? formatDecimal(item.weight) : null,
      price: formatDecimal(item.price),
      costPrice: formatDecimal(item.costPrice),
      costAmount: formatDecimal(item.costAmount),
      profit: formatDecimal(item.profit),
      commission: formatDecimal(item.commission),
      subtotal: formatDecimal(item.subtotal),
      imageUrl: item.imageUrl
    }))
  }
}

export function assertRetailCustomerName(value: unknown) {
  const name = assertName(value || '客户', '客户姓名')
  if (name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: '客户姓名不能超过80个字' })
  }
  return name
}

export function parseRetailProductPayload(body: any) {
  const sourceType = parseRetailSource(body?.sourceType)
  const unitType = parseUnitType(body?.unitType)
  const name = assertName(body?.name, '商品名称')
  const description = String(body?.description || '').trim()
  if (description.length > 200) {
    throw createError({ statusCode: 400, statusMessage: '商品简述不能超过200个字' })
  }
  return {
    name,
    description: description || null,
    category: parseRetailCategory(body?.category),
    sourceType,
    goodsId: sourceType === 'stock' ? Number(body?.goodsId || 0) : null,
    unitType,
    price: toMoney(body?.price, '单价'),
    costPrice: toMoney(body?.costPrice || 0, '成本'),
    commission: toMoney(body?.commission, '佣金'),
    imageUrl: String(body?.imageUrl || '').trim() || null,
    sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : categorySort(parseRetailCategory(body?.category))
  }
}
