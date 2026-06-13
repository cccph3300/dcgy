export function normalizeBase64(value: string) {
  const match = value.match(/^data:[^;]+;base64,(.+)$/)
  return (match ? match[1] : value).replace(/\s/g, '')
}
