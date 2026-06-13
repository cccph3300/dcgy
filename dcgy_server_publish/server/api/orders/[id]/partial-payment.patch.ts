import { createError, readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { toMoney, formatDecimal } from '../../../utils/number'
import { recalculateCustomerDebt } from '../../../utils/customer-payments'
import { prisma } from '../../../utils/prisma'
import { createCustomerPaymentRecord, getCustomerUnpaidAmount } from '../../../utils/customer-payment-records'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const amount = toMoney(body?.amount, '订单部分还款金额')

  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '订单不存在' })
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id } })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '订单不存在' })
    }
    if (order.status !== 'unpaid') {
      throw createError({ statusCode: 400, statusMessage: '只有未付订单可以记录部分还款' })
    }

    const totalAmount = formatDecimal(order.totalAmount || 0)
    if (amount > totalAmount) {
      throw createError({ statusCode: 400, statusMessage: '订单部分还款不能大于订单总计' })
    }

    const customer = await tx.customer.findUnique({
      where: { id: order.customerId },
      select: { id: true, name: true, partialPayment: true }
    })
    if (!customer) {
      throw createError({ statusCode: 400, statusMessage: '客户不存在' })
    }

    const currentOrderPartialPayment = formatDecimal(order.partialPayment || 0)
    const availablePartialPayment = formatDecimal(customer.partialPayment || 0)
    const diffAmount = formatDecimal(amount - currentOrderPartialPayment)
    if (diffAmount > availablePartialPayment) {
      throw createError({ statusCode: 400, statusMessage: '订单部分还款不能大于当前客户未分配还款金额' })
    }

    const paidOff = amount >= totalAmount
    const paidAt = paidOff ? new Date() : null
    await tx.order.update({
      where: { id },
      data: {
        partialPayment: amount,
        status: paidOff ? 'paid' : 'unpaid',
        paidAt
      }
    })
    await tx.customer.update({
      where: { id: order.customerId },
      data: { partialPayment: formatDecimal(availablePartialPayment - diffAmount) }
    })
    await recalculateCustomerDebt(order.customerId, tx)
    const customerUnpaidAmount = await getCustomerUnpaidAmount(order.customerId, tx)
    await createCustomerPaymentRecord({
      tx,
      customer,
      staff,
      action: paidOff ? 'order_pay_off' : 'order_partial_payment',
      amount: diffAmount,
      unpaidAmount: customerUnpaidAmount,
      order
    })

    return {
      ok: true,
      orderId: id,
      status: paidOff ? 'paid' : 'unpaid',
      paidAt,
      partialPayment: amount,
      customerPartialPayment: formatDecimal(availablePartialPayment - diffAmount),
      unpaidAmount: paidOff ? 0 : formatDecimal(totalAmount - amount),
      customerUnpaidAmount
    }
  })
})
