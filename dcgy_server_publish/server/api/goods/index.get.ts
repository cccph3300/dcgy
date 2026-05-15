import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const goods = await prisma.goods.findMany({
    where: { enabled: true },
    orderBy: [{ stock: 'desc' }, { id: 'desc' }]
  })

  return goods.map(item => ({
    id: item.id,
    name: item.name,
    unitType: item.unitType,
    costPrice: formatDecimal(item.costPrice),
    salePrice: formatDecimal(item.salePrice),
    defaultCommission: formatDecimal(item.defaultCommission),
    stock: formatDecimal(item.stock),
    arrivedAt: item.arrivedAt,
    createdAt: item.createdAt
  }))
})
