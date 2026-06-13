import type { Prisma, SupermarketPaymentAction } from '@prisma/client'
import { prisma } from './prisma'
import { formatDecimal } from './number'

type PrismaExecutor = Prisma.TransactionClient | typeof prisma

type StaffSnapshot = {
  id: number
  name: string
}

type SupermarketSnapshot = {
  id: number
  name: string
}

type OrderSnapshot = {
  id: number
  orderNo: string
  createdAt: Date
}

type CreateSupermarketPaymentRecordInput = {
  tx?: PrismaExecutor
  supermarket: SupermarketSnapshot
  staff: StaffSnapshot
  action: SupermarketPaymentAction
  amount: number
  unpaidAmount: number
  order?: OrderSnapshot | null
}

export async function createSupermarketPaymentRecord(input: CreateSupermarketPaymentRecordInput) {
  if (input.amount === 0) return null
  const db = input.tx || prisma
  return db.supermarketPaymentRecord.create({
    data: {
      supermarketAccountId: input.supermarket.id,
      supermarketName: input.supermarket.name,
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
