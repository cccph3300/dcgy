import { createError, readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { mapRetailProduct, parseRetailProductPayload } from '../../../utils/retail'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const body = await readBody(event)
  const data = parseRetailProductPayload(body)
  if (data.sourceType === 'stock') {
    const goods = await prisma.goods.findFirst({ where: { id: Number(data.goodsId || 0), enabled: true } })
    if (!goods) {
      throw createError({ statusCode: 400, statusMessage: '请选择有效的库存商品' })
    }
  }

  const product = await prisma.retailProduct.create({
    data: {
      ...data,
      staffId: staff.id,
      staffName: staff.name
    },
    include: { goods: true }
  })

  return mapRetailProduct(product)
})
