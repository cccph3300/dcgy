import { getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const keyword = String(query.q || '').trim()
  const paged = query.page !== undefined || query.pageSize !== undefined
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 10)))
  const where = {
    enabled: true,
    ...(keyword ? { name: { contains: keyword } } : {})
  }

  const mapGoods = (item: any) => ({
    id: item.id,
    name: item.name,
    unitType: item.unitType,
    costPrice: formatDecimal(item.costPrice),
    salePrice: formatDecimal(item.salePrice),
    defaultCommission: formatDecimal(item.defaultCommission),
    saleCommission: formatDecimal(item.saleCommission || 0),
    stock: formatDecimal(item.stock),
    arrivedAt: item.arrivedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  })

  if (paged) {
    const [total, goods] = await Promise.all([
      prisma.goods.count({ where }),
      prisma.goods.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ])

    return {
      items: goods.map(mapGoods),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  }

  const goods = await prisma.goods.findMany({
    where,
    orderBy: [{ stock: 'desc' }, { id: 'desc' }]
  })

  return goods.map(mapGoods)
})
