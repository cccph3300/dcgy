import { createHash, randomBytes } from 'node:crypto'

export function hashPassword(password: string) {
  return createHash('sha256').update(`dcgy:${password}`).digest('hex')
}

export function createSessionToken() {
  return randomBytes(32).toString('hex')
}

export function hashToken(token: string) {
  return createHash('sha256').update(`session:${token}`).digest('hex')
}
