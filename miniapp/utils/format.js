export function money(value) {
  return Number(value || 0).toFixed(2)
}

export function numberText(value) {
  const num = Number(value || 0)
  return Number.isInteger(num) ? String(num) : num.toFixed(2)
}

export function todayText() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateText(value) {
  const date = new Date(value)
  const now = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  if (year === now.getFullYear()) return `${month}/${day}`
  return `${year}/${month}/${day}`
}

export function timeOnlyText(value) {
  const date = new Date(value)
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

export function timeText(value) {
  return `${dateText(value)} ${timeOnlyText(value)}`
}

export function statusText(status) {
  if (status === 'paid') return '已付清'
  if (status === 'cancelled') return '毁单'
  return '未付'
}
