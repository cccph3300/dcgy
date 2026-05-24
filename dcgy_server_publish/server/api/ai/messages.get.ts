import { getQuery } from 'h3'
import { requireStaff } from '../../utils/auth'
import { listAiChatMessages } from '../../utils/ai-chat-history'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const query = getQuery(event)
  const result = await listAiChatMessages(staff.id, {
    beforeId: query.beforeId,
    limit: query.limit
  })

  return {
    success: true,
    ...result
  }
})
