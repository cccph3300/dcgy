import { createError } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: '货物不存在' })
  }

  return prisma.goods.update({
    where: { id },
    data: {
      // 删除货物时同步清零库存，避免前台仍看到一条被隐藏但库存数未归零的数据。
      stock: 0,
      enabled: false
    }
  })
})
