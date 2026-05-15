import { readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { toMoney, toQuantity } from '../../../utils/number'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const quantity = toQuantity(body?.quantity, '入库数量')
  const costPrice = toMoney(body?.costPrice, '成本价')
  const salePrice = toMoney(body?.salePrice ?? body?.costPrice, '售卖价')
  const defaultCommission = toMoney(body?.defaultCommission, '佣金')

  return prisma.goods.update({
    where: { id },
    data: {
      stock: { increment: quantity },
      costPrice,
      salePrice,
      defaultCommission,
      arrivedAt: new Date()
    }
  })
})
