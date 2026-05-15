import { clearCurrentSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await clearCurrentSession(event)
  return { ok: true }
})
