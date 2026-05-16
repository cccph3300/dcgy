import { getQuery } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { mapRetailProduct, parseRetailCategory } from '../../../utils/retail'
import { paginationFromQuery } from '../../../utils/print-record-query'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const { page, pageSize, skip, take } = paginationFromQuery(query)
  const keyword = String(query.q || '').trim()
  const category = String(query.category || '').trim()
  const status = String(query.status || 'all')
  const paged = query.page !== undefined || query.pageSize !== undefined
  const where = {
    ...(keyword ? { name: { contains: keyword } } : {}),
    ...(category ? { category: parseRetailCategory(category) } : {}),
    ...(status === 'enabled' ? { enabled: true } : status === 'disabled' ? { enabled: false } : {})
  }

  const [total, products] = await Promise.all([
    paged ? prisma.retailProduct.count({ where }) : Promise.resolve(0),
    prisma.retailProduct.findMany({
      where,
      include: { goods: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { id: 'desc' }],
      skip: paged ? skip : 0,
      take: paged ? take : undefined
    })
  ])

  const items = products.map(mapRetailProduct)
  if (!paged) return items

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
})
