import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const result = await prisma.order.deleteMany({
    where: { status: 'cancelled' }
  })

  return {
    ok: true,
    count: result.count
  }
})
