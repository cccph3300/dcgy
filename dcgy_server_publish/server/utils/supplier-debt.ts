import { prisma } from './prisma'
import { formatDecimal } from './number'
import { mapSupplierEntry } from './supplier-entries'

function oneYearAgo() {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 1)
  return date
}

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
        supplierId,
        createdAt: { gte: oneYearAgo() }
      },
      orderBy: { createdAt: 'desc' }
    })
  ])

  const totalAmount = entries.reduce((sum, entry) => sum + Number(entry.totalAmount), 0)
  const totalCommission = entries.reduce((sum, entry) => sum + Number(entry.totalCommission), 0)
  const partialPayment = Math.min(Number(supplier.partialPayment || 0), totalAmount)
  const unpaidAmount = Math.max(totalAmount - partialPayment, 0)

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      totalDebt: formatDecimal(totalAmount),
      partialPayment: formatDecimal(partialPayment)
    },
    totalAmount: formatDecimal(totalAmount),
    totalDebt: formatDecimal(totalAmount),
    totalCommission: formatDecimal(totalCommission),
    partialPayment: formatDecimal(partialPayment),
    unpaidAmount: formatDecimal(unpaidAmount),
    entryCount: entries.length,
    allEntryCount: allEntries.length,
    entries: entries.map(mapSupplierEntry),
    allEntries: allEntries.map(mapSupplierEntry)
  }
}
