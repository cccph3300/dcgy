import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { cleanupRetailImage } from '../../../utils/retail-image'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '商品ID不正确' })
  }

  const product = await prisma.retailProduct.findUnique({ where: { id } })
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: '商品不存在' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.retailOrderItem.updateMany({
      where: { productId: id },
      data: { productId: null }
    })
    await tx.retailProduct.delete({ where: { id } })
  })
  cleanupRetailImage(product.imageUrl)

  return { success: true }
})
