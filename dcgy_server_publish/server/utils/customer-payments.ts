import { createError } from 'h3'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { formatDecimal } from './number'

type TransactionClient = Prisma.TransactionClient
type PrismaExecutor = TransactionClient | typeof prisma

export async function recalculateCustomerDebt(customerId: number, tx: PrismaExecutor = prisma) {
  const orders = await tx.order.findMany({
    where: {
      customerId,
      status: 'unpaid'
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    select: {
      id: true,
      totalAmount: true,
      partialPayment: true
    }
  })
  const totalDebt = formatDecimal(orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0))

  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { partialPayment: true }
  })
  if (!customer) return totalDebt

  let allocatedPartialPayment = 0
  let availablePartialPayment = formatDecimal(customer.partialPayment || 0)
  for (const order of orders) {
    const totalAmount = formatDecimal(order.totalAmount || 0)
    const currentPartialPayment = formatDecimal(order.partialPayment || 0)
    const cappedPartialPayment = formatDecimal(Math.min(currentPartialPayment, totalAmount))
    if (cappedPartialPayment !== formatDecimal(order.partialPayment || 0)) {
      await tx.order.update({
        where: { id: order.id },
        data: { partialPayment: cappedPartialPayment }
      })
      availablePartialPayment = formatDecimal(availablePartialPayment + currentPartialPayment - cappedPartialPayment)
    }
    allocatedPartialPayment += cappedPartialPayment
  }
  allocatedPartialPayment = formatDecimal(allocatedPartialPayment)
  availablePartialPayment = Math.min(availablePartialPayment, Math.max(totalDebt - allocatedPartialPayment, 0))

  await tx.customer.update({
    where: { id: customerId },
    data: {
      totalDebt,
      partialPayment: availablePartialPayment
    }
  })

  return totalDebt
}

export async function applyPaidOrderToCustomer(order: { customerId: number }, tx: PrismaExecutor = prisma) {
  const customer = await tx.customer.findUnique({
    where: { id: order.customerId },
    select: { partialPayment: true }
  })
  if (!customer) {
    throw createError({ statusCode: 400, statusMessage: '客户不存在' })
  }
}
