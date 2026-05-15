import { getCurrentStaff } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  return { staff: await getCurrentStaff(event) }
})
