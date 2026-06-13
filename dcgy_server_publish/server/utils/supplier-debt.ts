import { prisma } from './prisma'
import { formatDecimal } from './number'
import { mapSupplierEntry } from './supplier-entries'

export async function getSupplierDebt(supplierId: number) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true, partialPayment: true, totalDebt: true }
  })
  if (!supplier) return null

  const [entries, allEntries] = await Promise.all([
    prisma.supplierEntry.findMany({
      where: {
        supplierId,
        status: 'unpaid'
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.supplierEntry.findMany({
      where: {
        supplierId
      },
      orderBy: { createdAt: 'desc' }
    })
  ])

  const totalAmount = entries.reduce((sum, entry) => sum + Number(entry.totalAmount), 0)
  const totalCommission = entries.reduce((sum, entry) => sum + Number(entry.totalCommission), 0)
  const allocatedPartialPayment = formatDecimal(entries.reduce((sum, entry) => {
    return sum + Math.min(Number(entry.partialPayment || 0), Number(entry.totalAmount || 0))
  }, 0))
  const availablePartialPayment = formatDecimal(Math.min(Number(supplier.partialPayment || 0), Math.max(totalAmount - allocatedPartialPayment, 0)))
  const partialPayment = formatDecimal(Math.min(allocatedPartialPayment + availablePartialPayment, totalAmount))
  const unpaidAmount = Math.max(totalAmount - partialPayment, 0)

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      totalDebt: formatDecimal(totalAmount),
      partialPayment,
      allocatedPartialPayment,
      availablePartialPayment
    },
    totalAmount: formatDecimal(totalAmount),
    totalDebt: formatDecimal(totalAmount),
    totalCommission: formatDecimal(totalCommission),
    partialPayment,
    allocatedPartialPayment,
    availablePartialPayment,
    unpaidAmount: formatDecimal(unpaidAmount),
    entryCount: entries.length,
    allEntryCount: allEntries.length,
    entries: entries.map(mapSupplierEntry),
    allEntries: allEntries.map(mapSupplierEntry)
  }
}
