import { createError, readBody } from 'h3'
import { requireStaff } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { toMoney, formatDecimal } from '../../../utils/number'
import { createSupermarketPaymentRecord } from '../../../utils/supermarket-payment-records'
import { ensureSupermarketAccount, getSupermarketUnpaidAmount, recalculateSupermarketDebt } from '../../../utils/supermarket-payments'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = Number(event.context.params?.id)
  const body = await readBody(event)
  const amount = toMoney(body?.amount, '部分还款金额')

  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '超市不存在' })
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.supermarketAccount.findUnique({
      where: { id },
      select: { id: true, name: true, partialPayment: true }
    })
    if (!account) {
      throw createError({ statusCode: 404, statusMessage: '超市不存在' })
    }

    const orders = await tx.supermarketOrder.findMany({
      where: {
        supermarketName: account.name,
        status: 'active'
      },
      select: {
        totalAmount: true,
        partialPayment: true
      }
    })
    const totalDebt = formatDecimal(orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0))
    const allocatedPartialPayment = formatDecimal(orders.reduce((sum, order) => {
      return sum + Math.min(Number(order.partialPayment || 0), Number(order.totalAmount || 0))
    }, 0))
    const maxAvailablePayment = formatDecimal(Math.max(totalDebt - allocatedPartialPayment, 0))
    if (amount > maxAvailablePayment) {
      throw createError({ statusCode: 400, statusMessage: '部分还款不能大于未分配欠账' })
    }

    const previousPartialPayment = formatDecimal(account.partialPayment || 0)
    const updated = await tx.supermarketAccount.update({
      where: { id },
      data: {
        totalDebt,
        partialPayment: amount
      },
      select: { id: true, name: true, partialPayment: true, totalDebt: true }
    })
    await recalculateSupermarketDebt(account.name, tx)
    const refreshed = await ensureSupermarketAccount(account.name, tx)
    const unpaidAmount = await getSupermarketUnpaidAmount(account.name, tx)
    await createSupermarketPaymentRecord({
      tx,
      supermarket: { id: refreshed.id, name: refreshed.name },
      staff,
      action: 'supermarket_partial_payment',
      amount: formatDecimal(amount - previousPartialPayment),
      unpaidAmount
    })

    return {
      ok: true,
      totalDebt,
      partialPayment: formatDecimal(updated.partialPayment),
      availablePartialPayment: formatDecimal(refreshed.partialPayment),
      allocatedPartialPayment,
      unpaidAmount
    }
  })
})
