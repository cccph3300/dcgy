import { getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const DEFAULT_CUSTOMER_NAME = '客户'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const keyword = String(getQuery(event).q ?? '').trim()
  if (!keyword) return []

  return prisma.customer.findMany({
    where: {
      name: {
        contains: keyword,
        not: DEFAULT_CUSTOMER_NAME
      }
    },
    orderBy: { id: 'desc' },
    take: 8,
    select: {
      id: true,
      name: true
    }
  })
})
