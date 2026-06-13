import type { Prisma, SupplierPaymentAction } from '@prisma/client'
import { prisma } from './prisma'
import { formatDecimal } from './number'

type PrismaExecutor = Prisma.TransactionClient | typeof prisma

type StaffSnapshot = {
  id: number
  name: string
}

type SupplierSnapshot = {
  id: number
  name: string
}

type EntrySnapshot = {
  id: number
  entryNo: string
  createdAt: Date
}

type CreateSupplierPaymentRecordInput = {
  tx?: PrismaExecutor
  supplier: SupplierSnapshot
  staff: StaffSnapshot
  action: SupplierPaymentAction
  amount: number
  unpaidAmount: number
  entry?: EntrySnapshot | null
}

export async function createSupplierPaymentRecord(input: CreateSupplierPaymentRecordInput) {
  if (input.amount === 0) return null
  const db = input.tx || prisma
  return db.supplierPaymentRecord.create({
    data: {
      supplierId: input.supplier.id,
      supplierName: input.supplier.name,
      staffId: input.staff.id,
      staffName: input.staff.name,
      entryId: input.entry?.id,
      entryNo: input.entry?.entryNo,
      entryCreatedAt: input.entry?.createdAt,
      action: input.action,
      amount: formatDecimal(input.amount),
      unpaidAmount: formatDecimal(input.unpaidAmount)
    }
  })
}

export async function getSupplierUnpaidAmount(supplierId: number, tx: PrismaExecutor = prisma) {
  const supplier = await tx.supplier.findUnique({
    where: { id: supplierId },
    select: { partialPayment: true }
  })
  const result = await tx.supplierEntry.aggregate({
    where: {
      supplierId,
      status: 'unpaid'
    },
    _sum: {
      totalAmount: true,
      partialPayment: true
    }
  })
  const totalAmount = Number(result._sum.totalAmount || 0)
  const entryPartialPayment = Number(result._sum.partialPayment || 0)
  const supplierPartialPayment = Number(supplier?.partialPayment || 0)
  return formatDecimal(Math.max(totalAmount - entryPartialPayment - supplierPartialPayment, 0))
}
