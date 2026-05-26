import { getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const keyword = String(getQuery(event).q ?? '').trim()
  if (!keyword) return []

  return prisma.supplier.findMany({
    where: { name: { contains: keyword } },
    orderBy: { id: 'desc' },
    take: 8,
    select: {
      id: true,
      name: true
    }
  })
})
