import { createError } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'
import { recalculateSupplierDebt } from '../../utils/supplier-entries'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const entry = await prisma.supplierEntry.findUnique({ where: { id } })
  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: '入账记录不存在' })
  }
  if (entry.status !== 'paid') {
    throw createError({ statusCode: 400, statusMessage: '只有已付清入账记录可以删除' })
  }

  return prisma.$transaction(async (tx) => {
    if (entry.stockMode === 'auto_stocked') {
      if (!entry.goodsId) {
        throw createError({ statusCode: 400, statusMessage: '入账记录缺少库存关联，不能自动回滚' })
      }
      const goods = await tx.goods.findUnique({ where: { id: entry.goodsId } })
      if (!goods) {
        throw createError({ statusCode: 400, statusMessage: '关联库存不存在，不能自动回滚' })
      }
      const rollbackGoods = goods.enabled
        ? goods
        : await tx.goods.findFirst({
            where: {
              enabled: true,
              name: entry.goodsName,
              unitType: entry.unitType,
              stock: { gte: entry.quantity }
            },
            orderBy: { id: 'desc' }
          })
      if (!rollbackGoods) {
        throw createError({
          statusCode: 400,
          statusMessage: `${entry.goodsName}关联库存已停用，未找到可回滚的启用库存`
        })
      }
      if (Number(rollbackGoods.stock) < Number(entry.quantity)) {
        throw createError({
          statusCode: 400,
          statusMessage: `${entry.goodsName}库存仅剩${formatDecimal(rollbackGoods.stock)}件，不能回滚${formatDecimal(entry.quantity)}件`
        })
      }
      await tx.goods.update({
        where: { id: rollbackGoods.id },
        data: { stock: { decrement: entry.quantity } }
      })
    }

    await tx.supplierPaymentRecord.updateMany({
      where: { entryId: id },
      data: { entryId: null }
    })
    await tx.supplierEntry.delete({ where: { id } })
    await recalculateSupplierDebt(entry.supplierId, tx)
    return { ok: true }
  })
})
