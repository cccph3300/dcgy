import { getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const SORT_LETTERS = `${LETTERS}#`
const PINYIN_BOUNDARIES = [
  ['A', '阿'],
  ['B', '芭'],
  ['C', '擦'],
  ['D', '搭'],
  ['E', '蛾'],
  ['F', '发'],
  ['G', '噶'],
  ['H', '哈'],
  ['J', '击'],
  ['K', '喀'],
  ['L', '垃'],
  ['M', '妈'],
  ['N', '拿'],
  ['O', '哦'],
  ['P', '啪'],
  ['Q', '期'],
  ['R', '然'],
  ['S', '撒'],
  ['T', '塌'],
  ['W', '挖'],
  ['X', '昔'],
  ['Y', '压'],
  ['Z', '匝']
] as const

function getChineseInitial(char: string) {
  const code = char.charCodeAt(0)
  if (code < 0x4e00 || code > 0x9fa5) return ''
  for (let index = PINYIN_BOUNDARIES.length - 1; index >= 0; index -= 1) {
    const [letter, boundary] = PINYIN_BOUNDARIES[index]
    if (char.localeCompare(boundary, 'zh-Hans-CN-u-co-pinyin') >= 0) return letter
  }
  return ''
}

function getInitial(name: string) {
  const first = String(name || '').trim().charAt(0)
  if (!first) return '#'
  const upper = first.toUpperCase()
  if (/^[A-Z]$/.test(upper)) return upper
  const initial = getChineseInitial(first)
  return initial && LETTERS.includes(initial) ? initial : '#'
}

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
        _sum: { totalAmount: true },
        _count: { _all: true }
      })
    : []
  const debtMap = new Map(debts.map(item => [item.supplierId, item]))

  return suppliers
    .map((supplier) => {
      const debt = debtMap.get(supplier.id)
      const totalDebt = formatDecimal(debt?._sum.totalAmount || 0)
      const partialPayment = Math.min(formatDecimal(supplier.partialPayment || 0), totalDebt)
      return {
        id: supplier.id,
        name: supplier.name,
        initial: getInitial(supplier.name),
        debtAmount: formatDecimal(Math.max(totalDebt - partialPayment, 0)),
        totalDebt,
        partialPayment: formatDecimal(partialPayment),
        unpaidEntryCount: debt?._count._all || 0
      }
    })
    .sort((left, right) => {
      const initialCompare = SORT_LETTERS.indexOf(left.initial) - SORT_LETTERS.indexOf(right.initial)
      if (initialCompare !== 0) return initialCompare
      return left.name.localeCompare(right.name, 'zh-CN')
    })
})
