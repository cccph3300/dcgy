import { createError } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const DEFAULT_CUSTOMER_NAME = '客户'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '客户不存在' })
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, name: true }
  })
  if (!customer) {
    throw createError({ statusCode: 404, statusMessage: '客户不存在' })
  }
  if (customer.name === DEFAULT_CUSTOMER_NAME) {
    throw createError({ statusCode: 400, statusMessage: '默认客户不能删除' })
  }

  const orderCount = await prisma.order.count({ where: { customerId: id } })
  if (orderCount > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: '该客户有订单或欠款，不允许删除，请将订单全部删除才能删除客户'
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.customerPaymentRecord.deleteMany({ where: { customerId: id } })
    await tx.customer.delete({ where: { id } })
  })
  return { ok: true }
})
