import { createError, readBody } from 'h3'
import { requireStaff } from '../../utils/auth'
import { getCustomerDebt } from '../../utils/customer-debt'
import { buildXpyunDebtReceipt, sendXpyunPrint } from '../../utils/xpyun'
import { getPrintErrorMessage, savePrintRecord } from '../../utils/print-record'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const body = await readBody(event)
  const customerId = Number(body?.customerId || body?.id || 0)

  if (!Number.isFinite(customerId) || customerId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '客户不存在' })
  }

  const debt = await getCustomerDebt(customerId)
  if (!debt) {
    throw createError({ statusCode: 404, statusMessage: '客户不存在' })
  }
  if (!debt.orders.length) {
    throw createError({ statusCode: 400, statusMessage: '该客户没有未付账单' })
  }

  const content = buildXpyunDebtReceipt({
    customer: debt.customer,
    staffName: staff.name,
    totalAmount: debt.totalAmount,
    orderCount: debt.orderCount,
    orders: debt.orders
  })
  try {
    const result = await sendXpyunPrint(content)
    await savePrintRecord({
      type: 'customer_debt',
      status: 'success',
      staffId: staff.id,
      staffName: staff.name,
      customerId,
      customerName: debt.customer.name,
      content,
      response: result
    })

    return {
      ok: true,
      content,
      result
    }
  } catch (error) {
    await savePrintRecord({
      type: 'customer_debt',
      status: 'failed',
      staffId: staff.id,
      staffName: staff.name,
      customerId,
      customerName: debt.customer.name,
      content,
      errorMessage: getPrintErrorMessage(error)
    })
    throw error
  }
})
