import { readBody } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import {
  buildSupplierEntryInput,
  createSupplierEntryNo,
  mapSupplierEntry,
  recalculateSupplierDebt,
  upsertSupplierStockGoods
} from '../../utils/supplier-entries'
import { parseChinaDateTime } from '../../utils/date-query'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const body = await readBody(event)
  const input = buildSupplierEntryInput(body)

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.upsert({
      where: { name: input.supplierName },
      update: {},
      create: { name: input.supplierName }
    })
    const goods = input.stockMode === 'auto_stocked'
      ? await upsertSupplierStockGoods(tx, input)
      : null

    const entry = await tx.supplierEntry.create({
      data: {
        entryNo: createSupplierEntryNo(),
        supplierId: supplier.id,
        supplierName: supplier.name,
        staffId: staff.id,
        staffName: staff.name,
        goodsId: goods?.id || null,
        goodsName: input.goodsName,
        unitType: input.unitType,
        quantity: input.quantity,
        weight: input.weight,
        totalAmount: input.totalAmount,
        totalCommission: input.totalCommission,
        costPrice: input.costPrice,
        commission: input.commission,
        salePrice: input.salePrice,
        stockMode: input.stockMode,
        ...(body?.createdDate ? { createdAt: parseChinaDateTime(body.createdDate, body.createdTime || '00:00') } : {})
      }
    })

    await recalculateSupplierDebt(supplier.id, tx)
    return mapSupplierEntry(entry)
  })
})
