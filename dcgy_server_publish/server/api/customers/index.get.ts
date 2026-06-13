import { getQuery } from 'h3'
import { OrderStatus } from '@prisma/client'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getInitial, SORT_INITIALS } from '../../utils/initial'

const DEFAULT_CUSTOMER_NAME = '客户'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const keyword = String(getQuery(event).q ?? '').trim()

  const customers = await prisma.customer.findMany({
    where: {
      name: {
        not: DEFAULT_CUSTOMER_NAME,
        ...(keyword ? { contains: keyword } : {})
      }
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      partialPayment: true
    }
  })
  const customerIds = customers.map(customer => customer.id)
  const debts = customerIds.length
    ? await prisma.order.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: customerIds },
          status: OrderStatus.unpaid
        },
        _sum: { totalAmount: true, partialPayment: true },
        _count: { _all: true }
      })
    : []
  const debtMap = new Map(debts.map(item => [item.customerId, item]))

  return customers
    .map((customer) => {
      const debt = debtMap.get(customer.id)
      const debtAmount = Number(debt?._sum.totalAmount || 0)
      const allocatedPartialPayment = Math.min(Number(debt?._sum.partialPayment || 0), debtAmount)
      const availablePartialPayment = Math.min(Number(customer.partialPayment || 0), Math.max(debtAmount - allocatedPartialPayment, 0))
      const partialPayment = Math.min(allocatedPartialPayment + availablePartialPayment, debtAmount)
      return {
        id: customer.id,
        name: customer.name,
        initial: getInitial(customer.name),
        debtAmount: Number(Math.max(debtAmount - partialPayment, 0).toFixed(2)),
        totalDebt: Number(debtAmount.toFixed(2)),
        partialPayment: Number(partialPayment.toFixed(2)),
        allocatedPartialPayment: Number(allocatedPartialPayment.toFixed(2)),
        availablePartialPayment: Number(availablePartialPayment.toFixed(2)),
        unpaidOrderCount: debt?._count._all || 0
      }
    })
    .sort((left, right) => {
      const initialCompare = SORT_INITIALS.indexOf(left.initial) - SORT_INITIALS.indexOf(right.initial)
      if (initialCompare !== 0) return initialCompare
      return left.name.localeCompare(right.name, 'zh-CN')
    })
})
