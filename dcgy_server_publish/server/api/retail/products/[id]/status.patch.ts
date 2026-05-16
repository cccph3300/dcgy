import { createError, readBody } from 'h3'
import { requireStaff } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { mapRetailProduct } from '../../../../utils/retail'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '商品ID不正确' })
  }
  const body = await readBody(event)
  const enabled = Boolean(body?.enabled)

  const product = await prisma.retailProduct.update({
    where: { id },
    data: { enabled },
    include: { goods: true }
  })

  return mapRetailProduct(product)
})
