import { createError, readBody } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { assertName, toMoney, toQuantity } from '../../utils/number'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const name = assertName(body?.name, '商品名')
  const unitType = body?.unitType === 'qty' ? 'qty' : 'weight'
  const costPrice = toMoney(body?.costPrice, '成本价')
  const salePrice = toMoney(body?.salePrice ?? body?.costPrice, '售卖价')
  const defaultCommission = toMoney(body?.defaultCommission, '佣金')
  const stock = body?.stock === undefined ? undefined : toQuantity(body?.stock, '库存')

  const sameGoods = await prisma.goods.findFirst({
    where: {
      id: { not: id },
      name,
      unitType,
      costPrice,
      salePrice,
      defaultCommission,
      enabled: true
    },
    orderBy: { id: 'desc' }
  })

  if (sameGoods) {
    return prisma.$transaction(async (tx) => {
      const currentGoods = await tx.goods.findUnique({ where: { id } })
      if (!currentGoods) {
        throw createError({ statusCode: 404, statusMessage: '货物不存在' })
      }
      await tx.goods.update({
        where: { id: sameGoods.id },
        data: {
          stock: { increment: stock === undefined ? Number(currentGoods.stock) : stock },
          arrivedAt: new Date()
        }
      })
      // 改价后合并到已有库存时，入账记录也要指向新的库存行，否则后续删除入账会扣到已停用的旧库存。
      await tx.supplierEntry.updateMany({
        where: { goodsId: id },
        data: { goodsId: sameGoods.id }
      })
      return tx.goods.update({
        where: { id },
        data: { enabled: false }
      })
    })
  }

  return prisma.goods.update({
    where: { id },
    data: {
      name,
      unitType,
      costPrice,
      salePrice,
      defaultCommission,
      ...(stock === undefined ? {} : { stock })
    }
  })
})
