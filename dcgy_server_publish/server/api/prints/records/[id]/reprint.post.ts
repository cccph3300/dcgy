import { createError, getRouterParam } from 'h3'
import { requireStaff } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { getPrintErrorMessage, savePrintRecord } from '../../../../utils/print-record'
import { sendXpyunPrint } from '../../../../utils/xpyun'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = Number(getRouterParam(event, 'id') || 0)
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '打印记录不存在' })
  }

  const record = await prisma.printRecord.findUnique({ where: { id } })
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: '打印记录不存在' })
  }

  try {
    const result = await sendXpyunPrint(record.content)
    await savePrintRecord({
      type: record.type,
      status: 'success',
      staffId: staff.id,
      staffName: staff.name,
      orderId: record.orderId,
      orderNo: record.orderNo,
      customerId: record.customerId,
      customerName: record.customerName,
      content: record.content,
      response: result
    })

    return { ok: true, result }
  } catch (error) {
    await savePrintRecord({
      type: record.type,
      status: 'failed',
      staffId: staff.id,
      staffName: staff.name,
      orderId: record.orderId,
      orderNo: record.orderNo,
      customerId: record.customerId,
      customerName: record.customerName,
      content: record.content,
      errorMessage: getPrintErrorMessage(error)
    })
    throw error
  }
})
