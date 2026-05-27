import { createError } from 'h3'
import type { Prisma, SupplierEntry } from '@prisma/client'
import { assertName, formatDecimal, toMoney, toQuantity } from './number'
import { prisma } from './prisma'

type Tx = Prisma.TransactionClient
type PrismaExecutor = Tx | typeof prisma
type SupplierEntryWithRelations = Prisma.SupplierEntryGetPayload<{ include: { supplier: true } }>

export function createSupplierEntryNo() {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const time = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}${now.getMilliseconds()}`
  return `RZ${yy}${mm}${dd}${time}`
}

export function assertSupplierName(value: unknown) {
  const name = assertName(value, '货主名称')
  if (name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: '货主名称不能超过80个字' })
  }
  return name
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

export function buildSupplierEntryInput(body: any) {
  const supplierName = assertSupplierName(body?.supplierName)
  const goodsName = assertName(body?.goodsName, '品名')
  const unitType = body?.unitType === 'qty' ? 'qty' : 'weight'
  const quantity = toQuantity(body?.quantity, '数量')
  const weight = unitType === 'weight' ? parseWeight(body?.weight) : 0
  const totalAmount = toMoney(body?.totalAmount, '总金额')
  const totalCommission = toMoney(body?.totalCommission, '总佣金')
  const salePrice = toMoney(body?.salePrice, '售卖价')
  const saleCommission = toMoney(body?.saleCommission, '售卖佣金')
  const stockMode = body?.stockMode === 'auto_stocked' ? 'auto_stocked' : 'record_only'

  if (unitType === 'weight' && weight <= 0) {
    throw createError({ statusCode: 400, statusMessage: '按重量计费时必须填写总重量' })
  }
  if (totalAmount <= 0) {
    throw createError({ statusCode: 400, statusMessage: '总金额必须大于0' })
  }
  if (totalCommission > totalAmount) {
    throw createError({ statusCode: 400, statusMessage: '总佣金不能大于总金额' })
  }
  if (salePrice <= 0) {
    throw createError({ statusCode: 400, statusMessage: '售卖价必须大于0' })
  }

  const billingAmount = unitType === 'weight' ? weight : quantity
  const costPrice = roundMoney((totalAmount - totalCommission) / billingAmount)
  const commission = roundMoney(totalCommission / quantity)

  return {
    supplierName,
    goodsName,
    unitType,
    quantity,
    weight: unitType === 'weight' ? weight : null,
    totalAmount,
    totalCommission,
    costPrice,
    commission,
    saleCommission,
    salePrice,
    stockMode
  }
}

export async function upsertSupplierStockGoods(tx: Tx, entry: ReturnType<typeof buildSupplierEntryInput>) {
  const sameGoods = await tx.goods.findFirst({
    where: {
      name: entry.goodsName,
      unitType: entry.unitType,
      costPrice: entry.costPrice,
      salePrice: entry.salePrice,
      defaultCommission: entry.commission,
      saleCommission: entry.saleCommission,
      enabled: true
    },
    orderBy: { id: 'desc' }
  })

  if (sameGoods) {
    return tx.goods.update({
      where: { id: sameGoods.id },
      data: {
        stock: { increment: entry.quantity },
        arrivedAt: new Date()
      }
    })
  }

  const disabledGoods = await tx.goods.findFirst({
    where: { name: entry.goodsName, enabled: false },
    orderBy: { id: 'desc' }
  })

  if (disabledGoods) {
    return tx.goods.update({
      where: { id: disabledGoods.id },
      data: {
        name: entry.goodsName,
        unitType: entry.unitType,
        costPrice: entry.costPrice,
        salePrice: entry.salePrice,
        defaultCommission: entry.commission,
        saleCommission: entry.saleCommission,
        stock: entry.quantity,
        enabled: true,
        arrivedAt: new Date()
      }
    })
  }

  return tx.goods.create({
    data: {
      name: entry.goodsName,
      unitType: entry.unitType,
      costPrice: entry.costPrice,
      salePrice: entry.salePrice,
      defaultCommission: entry.commission,
      saleCommission: entry.saleCommission,
      stock: entry.quantity
    }
  })
}

export async function recalculateSupplierDebt(supplierId: number, tx: PrismaExecutor = prisma) {
  const result = await tx.supplierEntry.aggregate({
    where: {
      supplierId,
      status: 'unpaid'
    },
    _sum: { totalAmount: true }
  })
  const totalDebt = formatDecimal(result._sum.totalAmount || 0)
  const supplier = await tx.supplier.findUnique({
    where: { id: supplierId },
    select: { partialPayment: true }
  })
  if (!supplier) return totalDebt

  const partialPayment = Math.min(formatDecimal(supplier.partialPayment || 0), totalDebt)
  await tx.supplier.update({
    where: { id: supplierId },
    data: {
      totalDebt,
      partialPayment
    }
  })
  return totalDebt
}

export async function applyPaidEntryToSupplier(entry: { supplierId: number, totalAmount: unknown }, tx: PrismaExecutor = prisma) {
  const supplier = await tx.supplier.findUnique({
    where: { id: entry.supplierId },
    select: { partialPayment: true }
  })
  if (!supplier) {
    throw createError({ statusCode: 400, statusMessage: '货主不存在' })
  }

  const nextPartialPayment = Math.max(formatDecimal(supplier.partialPayment || 0) - formatDecimal(entry.totalAmount || 0), 0)
  await tx.supplier.update({
    where: { id: entry.supplierId },
    data: { partialPayment: nextPartialPayment }
  })
}

export function mapSupplierEntry(entry: SupplierEntry | SupplierEntryWithRelations) {
  return {
    id: entry.id,
    entryNo: entry.entryNo,
    supplierId: entry.supplierId,
    supplierName: entry.supplierName,
    staffName: entry.staffName,
    goodsId: entry.goodsId,
    goodsName: entry.goodsName,
    unitType: entry.unitType,
    quantity: formatDecimal(entry.quantity),
    weight: entry.weight ? formatDecimal(entry.weight) : null,
    totalAmount: formatDecimal(entry.totalAmount),
    totalCommission: formatDecimal(entry.totalCommission),
    costPrice: formatDecimal(entry.costPrice),
    commission: formatDecimal(entry.commission),
    saleCommission: formatDecimal(entry.saleCommission || 0),
    salePrice: formatDecimal(entry.salePrice),
    stockMode: entry.stockMode,
    status: entry.status,
    paidAt: entry.paidAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  }
}
