import { createError, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { createSessionToken, hashPassword, hashToken } from '../../utils/security'
import { getSessionExpiresAt, setSessionCookie } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = String(body?.username ?? '').trim()
  const password = String(body?.password ?? '')

  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: '账号和密码不能为空' })
  }

  const staff = await prisma.staffUser.findUnique({ where: { username } })
  if (!staff || !staff.enabled || staff.passwordHash !== hashPassword(password)) {
    throw createError({ statusCode: 401, statusMessage: '账号或密码不正确' })
  }

  const token = createSessionToken()
  await prisma.staffSession.create({
    data: {
      tokenHash: hashToken(token),
      staffId: staff.id,
      expiresAt: getSessionExpiresAt()
    }
  })
  await setSessionCookie(event, token)

  return {
    token,
    staff: { id: staff.id, username: staff.username, name: staff.name },
    id: staff.id,
    username: staff.username,
    name: staff.name
  }
})
