import { createError, readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { cleanupRetailImage } from '../../../utils/retail-image'
import { mapRetailProduct, parseRetailProductPayload } from '../../../utils/retail'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '商品ID不正确' })
  }
  const body = await readBody(event)
  const data = parseRetailProductPayload(body)
  if (data.sourceType === 'stock') {
    const goods = await prisma.goods.findFirst({ where: { id: Number(data.goodsId || 0), enabled: true } })
    if (!goods) {
      throw createError({ statusCode: 400, statusMessage: '请选择有效的库存商品' })
    }
  }

  const oldProduct = await prisma.retailProduct.findUnique({ where: { id } })
  if (!oldProduct) {
    throw createError({ statusCode: 404, statusMessage: '商品不存在' })
  }

  const product = await prisma.retailProduct.update({
    where: { id },
    data,
    include: { goods: true }
  })
  if (oldProduct.imageUrl !== product.imageUrl) cleanupRetailImage(oldProduct.imageUrl)

  return mapRetailProduct(product)
})
