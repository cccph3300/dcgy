import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { imageDataUrlFromLocalPath, mapPublicRetailProduct, parseRetailCategory } from '../../../utils/retail'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const keyword = String(query.q || '').trim()
  const category = String(query.category || '').trim()
  const includeImageData = String(query.imageData || '') === '1'

  const products = await prisma.retailProduct.findMany({
    where: {
      enabled: true,
      ...(keyword ? { name: { contains: keyword } } : {}),
      ...(category ? { category: parseRetailCategory(category) } : {})
    },
    include: { goods: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { id: 'desc' }]
  })

  if (!includeImageData) return products.map(mapPublicRetailProduct)

  return Promise.all(products.map(async (product) => {
    const mapped = mapPublicRetailProduct(product)
    return {
      ...mapped,
      imageDataUrl: await imageDataUrlFromLocalPath(mapped.imageUrl)
    }
  }))
})
