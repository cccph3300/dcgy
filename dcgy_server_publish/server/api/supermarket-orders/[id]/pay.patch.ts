import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { mapSupermarketOrder } from '../../../utils/supermarket-orders'
import { formatDecimal } from '../../../utils/number'
import { createSupermarketPaymentRecord } from '../../../utils/supermarket-payment-records'
import { ensureSupermarketAccount, getSupermarketUnpaidAmount, recalculateSupermarketDebt } from '../../../utils/supermarket-payments'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = Number(event.context.params?.id)

  return prisma.$transaction(async (tx) => {
    const order = await tx.supermarketOrder.findUnique({
      where: { id },
      include: {
        items: true,
        adjustments: { orderBy: { sortOrder: 'asc' } }
      }
    })

    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '超市订单不存在' })
    }
    if (order.status !== 'active') {
      throw createError({ statusCode: 400, statusMessage: '只有未结超市订单可以结账' })
    }

    const account = await ensureSupermarketAccount(order.supermarketName, tx)
    const updated = await tx.supermarketOrder.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: new Date()
      },
      include: {
        items: true,
        adjustments: { orderBy: { sortOrder: 'asc' } }
      }
    })

    await recalculateSupermarketDebt(order.supermarketName, tx)
    const unpaidAmount = await getSupermarketUnpaidAmount(order.supermarketName, tx)
    await createSupermarketPaymentRecord({
      tx,
      supermarket: { id: account.id, name: account.name },
      staff,
      action: 'order_pay_off',
      amount: formatDecimal(Number(order.totalAmount || 0) - Number(order.partialPayment || 0)),
      unpaidAmount,
      order
    })

    return mapSupermarketOrder(updated)
  })
})
