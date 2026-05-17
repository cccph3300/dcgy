import { createError } from 'h3'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { formatDecimal } from './number'

type TransactionClient = Prisma.TransactionClient
type PrismaExecutor = TransactionClient | typeof prisma

export async function recalculateCustomerDebt(customerId: number, tx: PrismaExecutor = prisma) {
  const result = await tx.order.aggregate({
    where: {
      customerId,
      status: 'unpaid'
    },
    _sum: { totalAmount: true }
  })
  const totalDebt = formatDecimal(result._sum.totalAmount || 0)

  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { partialPayment: true }
  })
  if (!customer) return totalDebt

  const partialPayment = Math.min(formatDecimal(customer.partialPayment || 0), totalDebt)
  await tx.customer.update({
    where: { id: customerId },
    data: {
      totalDebt,
      partialPayment
    }
  })

  return totalDebt
}

export async function applyPaidOrderToCustomer(order: { customerId: number, totalAmount: unknown }, tx: PrismaExecutor = prisma) {
  const customer = await tx.customer.findUnique({
    where: { id: order.customerId },
    select: { partialPayment: true }
  })
  if (!customer) {
    throw createError({ statusCode: 400, statusMessage: '客户不存在' })
  }

  const nextPartialPayment = Math.max(formatDecimal(customer.partialPayment || 0) - formatDecimal(order.totalAmount || 0), 0)
  await tx.customer.update({
    where: { id: order.customerId },
    data: { partialPayment: nextPartialPayment }
  })
}
