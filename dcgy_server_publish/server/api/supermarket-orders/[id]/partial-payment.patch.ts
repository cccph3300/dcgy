import { createError, readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { toMoney, formatDecimal } from '../../../utils/number'
import { prisma } from '../../../utils/prisma'
import { createSupermarketPaymentRecord } from '../../../utils/supermarket-payment-records'
import { ensureSupermarketAccount, getSupermarketUnpaidAmount, recalculateSupermarketDebt } from '../../../utils/supermarket-payments'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const amount = toMoney(body?.amount, '订单部分还款金额')

  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '超市订单不存在' })
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.supermarketOrder.findUnique({ where: { id } })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '超市订单不存在' })
    }
    if (order.status !== 'active') {
      throw createError({ statusCode: 400, statusMessage: '只有未结订单可以记录部分还款' })
    }

    const totalAmount = formatDecimal(order.totalAmount || 0)
    if (amount > totalAmount) {
      throw createError({ statusCode: 400, statusMessage: '订单部分还款不能大于订单总计' })
    }

    const account = await ensureSupermarketAccount(order.supermarketName, tx)
    const currentOrderPartialPayment = formatDecimal(order.partialPayment || 0)
    const availablePartialPayment = formatDecimal(account.partialPayment || 0)
    const diffAmount = formatDecimal(amount - currentOrderPartialPayment)
    if (diffAmount > availablePartialPayment) {
      throw createError({ statusCode: 400, statusMessage: '订单部分还款不能大于当前超市未分配还款金额' })
    }

    const paidOff = amount >= totalAmount
    const paidAt = paidOff ? new Date() : null
    await tx.supermarketOrder.update({
      where: { id },
      data: {
        partialPayment: amount,
        status: paidOff ? 'paid' : 'active',
        paidAt
      }
    })
    await tx.supermarketAccount.update({
      where: { id: account.id },
      data: { partialPayment: formatDecimal(availablePartialPayment - diffAmount) }
    })
    await recalculateSupermarketDebt(order.supermarketName, tx)
    const supermarketUnpaidAmount = await getSupermarketUnpaidAmount(order.supermarketName, tx)
    await createSupermarketPaymentRecord({
      tx,
      supermarket: { id: account.id, name: account.name },
      staff,
      action: paidOff ? 'order_pay_off' : 'order_partial_payment',
      amount: diffAmount,
      unpaidAmount: supermarketUnpaidAmount,
      order
    })

    return {
      ok: true,
      orderId: id,
      status: paidOff ? 'paid' : 'active',
      paidAt,
      partialPayment: amount,
      supermarketPartialPayment: formatDecimal(availablePartialPayment - diffAmount),
      unpaidAmount: paidOff ? 0 : formatDecimal(totalAmount - amount),
      supermarketUnpaidAmount
    }
  })
})
