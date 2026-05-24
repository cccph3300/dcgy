import { readBody, createError } from 'h3'
import { requireStaff } from '../../utils/auth'
import { answerAiChat, validateAiChatInput, type AiChatInput } from '../../utils/ai-chat-service'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const input = await readBody<AiChatInput>(event)

  try {
    validateAiChatInput(input)
    return await answerAiChat(input, staff.id)
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      statusMessage: String(error?.message || 'AI 对话失败')
    })
  }
})
