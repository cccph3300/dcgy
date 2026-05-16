import { createError } from 'h3'

export function dateRangeFromQuery(query: Record<string, unknown>) {
  const mode = String(query.mode || 'day')
  const day = String(query.day || '').trim()
  const startDate = String(query.startDate || '').trim()
  const endDate = String(query.endDate || '').trim()
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  if (mode === 'all') return {}

  if (mode === 'month') {
    const baseText = day || today
    const base = parseDate(baseText)
    const start = new Date(base.getFullYear(), base.getMonth(), 1)
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 1)
    return { gte: start, lt: end }
  }

  if (mode === 'range') {
    const start = parseDate(startDate || today)
    const end = parseDate(endDate || startDate || today)
    end.setDate(end.getDate() + 1)
    return { gte: start, lt: end }
  }

  const target = parseDate(day || today)
  const next = new Date(target)
  next.setDate(next.getDate() + 1)
  return { gte: target, lt: next }
}

export function paginationFromQuery(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 10)))
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  }
}

function parseDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    throw createError({ statusCode: 400, statusMessage: '日期格式必须是 YYYY-MM-DD' })
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}
