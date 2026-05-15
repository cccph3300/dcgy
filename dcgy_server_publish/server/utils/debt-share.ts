import { createHmac, timingSafeEqual } from 'node:crypto'

const SHARE_DAYS = 30

function secret() {
  return process.env.SESSION_SECRET || 'dcgy-share-secret'
}

function sign(customerId: number, expiresAt: number) {
  return createHmac('sha256', secret()).update(`${customerId}.${expiresAt}`).digest('hex')
}

export function createDebtShareToken(customerId: number) {
  const expiresAt = Date.now() + SHARE_DAYS * 24 * 60 * 60 * 1000
  const signature = sign(customerId, expiresAt)
  return Buffer.from(`${customerId}.${expiresAt}.${signature}`, 'utf8').toString('base64url')
}

export function verifyDebtShareToken(customerId: number, token: string) {
  try {
    const [idText, expiresText, signature] = Buffer.from(token, 'base64url').toString('utf8').split('.')
    const tokenCustomerId = Number(idText)
    const expiresAt = Number(expiresText)
    if (tokenCustomerId !== customerId || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return false

    const expected = Buffer.from(sign(customerId, expiresAt), 'hex')
    const actual = Buffer.from(signature || '', 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
