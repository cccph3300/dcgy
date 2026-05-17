import { dateWhereFromQuery } from './date-query'

export function dateRangeFromQuery(query: Record<string, unknown>) {
  return dateWhereFromQuery(query)
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
