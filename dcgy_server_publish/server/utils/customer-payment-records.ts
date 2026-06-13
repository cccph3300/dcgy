import type { CustomerPaymentAction, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { formatDecimal } from './number'

type PrismaExecutor = Prisma.TransactionClient | typeof prisma

type StaffSnapshot = {
  id: number
  name: string
}

type CustomerSnapshot = {
  id: number
  name: string
}

type OrderSnapshot = {
  id: number
  orderNo: string
  createdAt: Date
}

type CreateCustomerPaymentRecordInput = {
  tx?: PrismaExecutor
  customer: CustomerSnapshot
  staff: StaffSnapshot
  action: CustomerPaymentAction
  amount: number
  unpaidAmount: number
  order?: OrderSnapshot | null
}

export async function createCustomerPaymentRecord(input: CreateCustomerPaymentRecordInput) {
  if (input.amount === 0) return null
  const db = input.tx || prisma
  return db.customerPaymentRecord.create({
    data: {
      customerId: input.customer.id,
      customerName: input.customer.name,
      staffId: input.staff.id,
      staffName: input.staff.name,
      orderId: input.order?.id,
      orderNo: input.order?.orderNo,
      orderCreatedAt: input.order?.createdAt,
      action: input.action,
      amount: formatDecimal(input.amount),
      unpaidAmount: formatDecimal(input.unpaidAmount)
    }
  })
}

export async function getCustomerUnpaidAmount(customerId: number, tx: PrismaExecutor = prisma) {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { partialPayment: true }
  })
  const result = await tx.order.aggregate({
    where: {
      customerId,
      status: 'unpaid'
    },
    _sum: {
      totalAmount: true,
      partialPayment: true
    }
  })
  const totalAmount = Number(result._sum.totalAmount || 0)
  const orderPartialPayment = Number(result._sum.partialPayment || 0)
  const customerPartialPayment = Number(customer?.partialPayment || 0)
  return formatDecimal(Math.max(totalAmount - orderPartialPayment - customerPartialPayment, 0))
}
