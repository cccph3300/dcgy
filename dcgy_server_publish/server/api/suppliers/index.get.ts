import { getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'
import { getInitial, SORT_INITIALS } from '../../utils/initial'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const keyword = String(getQuery(event).q ?? '').trim()

  const suppliers = await prisma.supplier.findMany({
    where: keyword ? { name: { contains: keyword } } : {},
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      partialPayment: true
    }
  })
  const supplierIds = suppliers.map(supplier => supplier.id)
  const debts = supplierIds.length
    ? await prisma.supplierEntry.groupBy({
        by: ['supplierId'],
        where: {
          supplierId: { in: supplierIds },
          status: 'unpaid'
        },
        _sum: { totalAmount: true, partialPayment: true },
        _count: { _all: true }
      })
    : []
  const debtMap = new Map(debts.map(item => [item.supplierId, item]))

  return suppliers
    .map((supplier) => {
      const debt = debtMap.get(supplier.id)
      const totalDebt = formatDecimal(debt?._sum.totalAmount || 0)
      const allocatedPartialPayment = Math.min(formatDecimal(debt?._sum.partialPayment || 0), totalDebt)
      const availablePartialPayment = Math.min(formatDecimal(supplier.partialPayment || 0), Math.max(totalDebt - allocatedPartialPayment, 0))
      const partialPayment = Math.min(allocatedPartialPayment + availablePartialPayment, totalDebt)
      return {
        id: supplier.id,
        name: supplier.name,
        initial: getInitial(supplier.name),
        debtAmount: formatDecimal(Math.max(totalDebt - partialPayment, 0)),
        totalDebt,
        partialPayment: formatDecimal(partialPayment),
        allocatedPartialPayment: formatDecimal(allocatedPartialPayment),
        availablePartialPayment: formatDecimal(availablePartialPayment),
        unpaidEntryCount: debt?._count._all || 0
      }
    })
    .sort((left, right) => {
      const initialCompare = SORT_INITIALS.indexOf(left.initial) - SORT_INITIALS.indexOf(right.initial)
      if (initialCompare !== 0) return initialCompare
      return left.name.localeCompare(right.name, 'zh-CN')
    })
})
