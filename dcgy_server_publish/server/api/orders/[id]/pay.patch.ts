import { createError } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { applyPaidOrderToCustomer, recalculateCustomerDebt } from '../../../utils/customer-payments'
import { formatDecimal } from '../../../utils/number'
import { createCustomerPaymentRecord, getCustomerUnpaidAmount } from '../../../utils/customer-payment-records'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = Number(event.context.params?.id)
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: '订单不存在' })
  }
  if (order.status !== 'unpaid') {
    throw createError({ statusCode: 400, statusMessage: '只有未付订单可以标记已付清' })
  }

  return prisma.$transaction(async (tx) => {
    await applyPaidOrderToCustomer(order, tx)
    const paidOrder = await tx.order.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date() }
    })
    await recalculateCustomerDebt(order.customerId, tx)
    const unpaidAmount = await getCustomerUnpaidAmount(order.customerId, tx)
    await createCustomerPaymentRecord({
      tx,
      customer: { id: order.customerId, name: order.customerName },
      staff,
      action: 'order_pay_off',
      amount: formatDecimal(Number(order.totalAmount || 0) - Number(order.partialPayment || 0)),
      unpaidAmount,
      order
    })
    return paidOrder
  })
})
