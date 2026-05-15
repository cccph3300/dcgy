import { createError, getRouterParam } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(getRouterParam(event, 'id') || 0)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '打印记录不存在' })
  }

  const record = await prisma.printRecord.findUnique({ where: { id } })
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: '打印记录不存在' })
  }

  await prisma.printRecord.delete({ where: { id } })
  return { ok: true }
})
