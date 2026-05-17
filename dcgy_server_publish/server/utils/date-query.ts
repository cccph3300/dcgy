import { createError } from 'h3'

export function todayInChina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
}

export function chinaDayRange(dateText: string) {
  const [year, month, day] = parseDateParts(dateText)
  return {
    start: new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0)),
    end: new Date(Date.UTC(year, month - 1, day + 1, -8, 0, 0, 0))
  }
}

export function chinaMonthRange(dateText: string) {
  const [year, month] = parseDateParts(dateText)
  return {
    start: new Date(Date.UTC(year, month - 1, 1, -8, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, -8, 0, 0, 0))
  }
}

export function dateWhereFromQuery(query: Record<string, unknown>) {
  const mode = String(query.mode || '').trim()
  const date = String(query.date || '').trim()
  const day = String(query.day || date || todayInChina()).trim()
  const startDate = String(query.startDate || day).trim()
  const endDate = String(query.endDate || startDate).trim()

  if (mode === 'all' || date === 'all') return {}

  if (mode === 'month') {
    const range = chinaMonthRange(day)
    return { gte: range.start, lt: range.end }
  }

  if (mode === 'range' || date === 'range') {
    const start = chinaDayRange(startDate).start
    const end = chinaDayRange(endDate).end
    if (start > end) {
      throw createError({ statusCode: 400, statusMessage: '开始日期不能大于结束日期' })
    }
    return { gte: start, lt: end }
  }

  const range = chinaDayRange(day)
  return { gte: range.start, lt: range.end }
}

export function parseChinaDateTime(dateText: unknown, timeText: unknown = '00:00') {
  const date = String(dateText || '').trim()
  const time = String(timeText || '00:00').trim()
  const [year, month, day] = parseDateParts(date)
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    throw createError({ statusCode: 400, statusMessage: '时间格式必须是 HH:mm' })
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw createError({ statusCode: 400, statusMessage: '时间不合法' })
  }
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0, 0))
}

function parseDateParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    throw createError({ statusCode: 400, statusMessage: '日期格式必须是 YYYY-MM-DD' })
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}
