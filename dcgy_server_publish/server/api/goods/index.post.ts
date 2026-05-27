import { readBody } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { assertName, toMoney, toQuantity } from '../../utils/number'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const body = await readBody(event)
  const name = assertName(body?.name, '商品名')
  const unitType = body?.unitType === 'qty' ? 'qty' : 'weight'
  const costPrice = toMoney(body?.costPrice, '成本价')
  const salePrice = toMoney(body?.salePrice ?? body?.costPrice, '售卖价')
  const defaultCommission = toMoney(body?.defaultCommission, '成本佣金')
  const saleCommission = toMoney(body?.saleCommission, '售卖佣金')
  const stock = toQuantity(body?.stock, '库存')

  const sameGoods = await prisma.goods.findFirst({
    where: {
      name,
      unitType,
      costPrice,
      salePrice,
      defaultCommission,
      saleCommission,
      enabled: true
    },
    orderBy: { id: 'desc' }
  })

  if (sameGoods) {
    return prisma.goods.update({
      where: { id: sameGoods.id },
      data: {
        stock: { increment: stock },
        arrivedAt: new Date()
      }
    })
  }

  const disabledGoods = await prisma.goods.findFirst({
    where: { name, enabled: false },
    orderBy: { id: 'desc' }
  })

  if (disabledGoods) {
    return prisma.goods.update({
      where: { id: disabledGoods.id },
      data: {
        name,
        unitType,
        costPrice,
        salePrice,
        defaultCommission,
        saleCommission,
        stock,
        enabled: true,
        arrivedAt: new Date()
      }
    })
  }

  return prisma.goods.create({
    data: { name, unitType, costPrice, salePrice, defaultCommission, saleCommission, stock }
  })
})
