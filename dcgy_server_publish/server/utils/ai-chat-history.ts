import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export const AI_CHAT_MAX_MESSAGES = 50
export const AI_CHAT_TRIM_COUNT = 10
export const AI_CHAT_PAGE_SIZE = 10

type AiChatRole = 'user' | 'assistant'
type AiChatDb = typeof prisma

function normalizePageSize(value: unknown) {
  const size = Number(value || AI_CHAT_PAGE_SIZE)
  if (!Number.isFinite(size)) return AI_CHAT_PAGE_SIZE
  return Math.min(50, Math.max(1, Math.floor(size)))
}

export async function listAiChatMessages(staffId: number, options: { beforeId?: unknown, limit?: unknown } = {}) {
  const beforeId = Number(options.beforeId || 0)
  const limit = normalizePageSize(options.limit)
  const items = beforeId > 0
    ? await prisma.$queryRaw<Array<{ id: number, staffId: number, role: AiChatRole, content: string, createdAt: Date }>>`
        SELECT id, staff_id AS staffId, role, content, created_at AS createdAt
        FROM ai_chat_messages
        WHERE staff_id = ${staffId} AND id < ${beforeId}
        ORDER BY id DESC
        LIMIT ${limit + 1}
      `
    : await prisma.$queryRaw<Array<{ id: number, staffId: number, role: AiChatRole, content: string, createdAt: Date }>>`
        SELECT id, staff_id AS staffId, role, content, created_at AS createdAt
        FROM ai_chat_messages
        WHERE staff_id = ${staffId}
        ORDER BY id DESC
        LIMIT ${limit + 1}
      `
  const pageItems = items.slice(0, limit).reverse()

  return {
    items: pageItems,
    hasMore: items.length > limit,
    nextBeforeId: pageItems[0]?.id || null
  }
}

export async function saveAiChatMessage(
  tx: AiChatDb,
  input: { staffId: number, role: AiChatRole, content: string }
) {
  const content = input.content.trim()
  if (!content) return null

  await tx.$executeRaw`
    INSERT INTO ai_chat_messages (staff_id, role, content)
    VALUES (${input.staffId}, ${input.role}, ${content})
  `
  return true
}

export async function trimAiChatMessages(tx: AiChatDb, staffId: number) {
  const rows = await tx.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*) AS total
    FROM ai_chat_messages
    WHERE staff_id = ${staffId}
  `
  const count = Number(rows[0]?.total || 0)
  if (count <= AI_CHAT_MAX_MESSAGES) return 0

  const removeCount = Math.min(AI_CHAT_TRIM_COUNT, count - AI_CHAT_MAX_MESSAGES + AI_CHAT_TRIM_COUNT - 1)
  const expired = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id
    FROM ai_chat_messages
    WHERE staff_id = ${staffId}
    ORDER BY id ASC
    LIMIT ${removeCount}
  `
  const ids = expired.map(item => item.id)
  if (!ids.length) return 0

  await tx.$executeRaw`
    DELETE FROM ai_chat_messages
    WHERE id IN (${Prisma.join(ids)})
  `
  return ids.length
}
