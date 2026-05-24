import type { H3Event } from 'h3'
import { createError, getCookie, getHeader, setCookie, deleteCookie } from 'h3'
import { prisma } from './prisma'
import { hashToken } from './security'

export const SESSION_COOKIE = 'dcgy_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 365

export async function setSessionCookie(event: H3Event, token: string) {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

function getRequestToken(event: H3Event) {
  const authorization = getHeader(event, 'authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (match?.[1]) return match[1].trim()
  return getCookie(event, SESSION_COOKIE)
}

export async function getCurrentStaff(event: H3Event) {
  const token = getRequestToken(event)
  return getStaffByToken(token)
}

export async function getStaffByToken(token?: string | null) {
  if (!token) return null

  const session = await prisma.staffSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { staff: true }
  })

  if (!session || session.expiresAt < new Date() || !session.staff.enabled) {
    return null
  }

  return {
    id: session.staff.id,
    username: session.staff.username,
    name: session.staff.name
  }
}

export async function requireStaff(event: H3Event) {
  const staff = await getCurrentStaff(event)
  if (!staff) {
    throw createError({ statusCode: 401, statusMessage: '请先登录' })
  }
  return staff
}

export async function clearCurrentSession(event: H3Event) {
  const token = getRequestToken(event)
  if (token) {
    await prisma.staffSession.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  clearSessionCookie(event)
}

export function getSessionExpiresAt() {
  return new Date(Date.now() + SESSION_MAX_AGE * 1000)
}
