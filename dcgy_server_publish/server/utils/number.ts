import { createError } from 'h3'

export function toMoney(value: unknown, field = '金额') {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num) || num < 0) {
    throw createError({ statusCode: 400, statusMessage: `${field}必须是非负数字` })
  }
  return Number(num.toFixed(2))
}

export function toQuantity(value: unknown, field = '数量') {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) {
    throw createError({ statusCode: 400, statusMessage: `${field}必须大于0` })
  }
  return Number(num.toFixed(2))
}

export function formatDecimal(value: { toString(): string } | number | string) {
  return Number(Number(value).toFixed(2))
}

export function assertName(value: unknown, field = '名称') {
  const name = String(value ?? '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: `${field}不能为空` })
  }
  if (name.length > 50) {
    throw createError({ statusCode: 400, statusMessage: `${field}不能超过50个字` })
  }
  return name
}
