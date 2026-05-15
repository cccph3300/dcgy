import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  return prisma.$transaction(async (tx) => {
    const goods = await tx.goods.findMany({
      where: {
        enabled: true,
        stock: 0
      },
      orderBy: [{ arrivedAt: 'desc' }, { id: 'desc' }]
    })

    if (goods.length) {
      await tx.goods.updateMany({
        where: { id: { in: goods.map(item => item.id) } },
        data: { enabled: false }
      })
    }

    return {
      count: goods.length,
      goods: goods.map(item => ({
        id: item.id,
        name: item.name,
        unitType: item.unitType,
        stock: formatDecimal(item.stock),
        salePrice: formatDecimal(item.salePrice),
        defaultCommission: formatDecimal(item.defaultCommission),
        arrivedAt: item.arrivedAt
      }))
    }
  })
})
