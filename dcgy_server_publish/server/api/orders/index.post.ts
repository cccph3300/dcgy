import { createError, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireStaff } from '../../utils/auth'
import { buildOrderItems, createOrderNo, deductStock, mapOrderItem } from '../../utils/orders'
import { recalculateCustomerDebt } from '../../utils/customer-payments'

const DEFAULT_CUSTOMER_NAME = '客户'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const body = await readBody(event)
  const requestedName = String(body?.customerName ?? '').trim()
  const customerId = Number(body?.customerId || 0)

  return prisma.$transaction(async (tx) => {
    let customer

    if (customerId > 0) {
      customer = await tx.customer.findUnique({ where: { id: customerId } })
      if (!customer) {
        throw createError({ statusCode: 400, statusMessage: '客户不存在' })
      }
    } else {
      const customerName = requestedName || DEFAULT_CUSTOMER_NAME
      if (customerName.length > 50) {
        throw createError({ statusCode: 400, statusMessage: '客户名不能超过50个字' })
      }
      customer = await tx.customer.upsert({
        where: { name: customerName },
        update: {},
        create: { name: customerName }
      })
    }

    const items = await buildOrderItems(tx, body?.items)
    await deductStock(tx, items)

    const goodsAmount = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
    const commission = Number(items.reduce((sum, item) => sum + item.commission, 0).toFixed(2))
    const profitAmount = Number(items.reduce((sum, item) => sum + item.profit, 0).toFixed(2))
    const totalAmount = goodsAmount

    const order = await tx.order.create({
      data: {
        orderNo: createOrderNo(),
        customerId: customer.id,
        customerName: customer.name,
        staffId: staff.id,
        staffName: staff.name,
        goodsAmount,
        commission,
        totalAmount,
        profitAmount,
        items: { create: items.map(mapOrderItem) }
      },
      include: { items: true }
    })
    await recalculateCustomerDebt(customer.id, tx)
    return order
  })
})
