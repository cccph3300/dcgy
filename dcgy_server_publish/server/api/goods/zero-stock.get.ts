import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const goods = await prisma.goods.findMany({
    where: {
      enabled: true,
      stock: 0
    },
    orderBy: [{ arrivedAt: 'desc' }, { id: 'desc' }]
  })

  return goods.map(item => ({
    id: item.id,
    name: item.name,
    unitType: item.unitType,
    stock: formatDecimal(item.stock),
    salePrice: formatDecimal(item.salePrice),
    defaultCommission: formatDecimal(item.defaultCommission),
    saleCommission: formatDecimal(item.saleCommission || 0),
    arrivedAt: item.arrivedAt
  }))
})
