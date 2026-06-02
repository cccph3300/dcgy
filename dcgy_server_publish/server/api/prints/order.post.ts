import { createError, readBody } from 'h3'
import { requireStaff } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { formatDecimal } from '../../utils/number'
import {
  buildOrderAdjustments,
  formatOrderAdjustment,
  parseOrderAdjustmentRemark,
  sumOrderAdjustments
} from '../../utils/orders'
import { buildXpyunReceipt, sendXpyunPrint } from '../../utils/xpyun'
import { getPrintErrorMessage, savePrintRecord } from '../../utils/print-record'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const body = await readBody(event)
  const orderId = Number(body?.orderId || body?.id || 0)

  let printOrder
  if (orderId > 0) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        adjustments: { orderBy: { sortOrder: 'asc' } }
      }
    })
    if (!order) {
      throw createError({ statusCode: 404, statusMessage: '订单不存在' })
    }
    if (!order.items.length) {
      throw createError({ statusCode: 400, statusMessage: '打印内容不能为空' })
    }

    printOrder = {
      orderNo: order.orderNo,
      customerName: order.customerName,
      staffName: order.staffName,
      createdAt: order.createdAt,
      totalAmount: formatDecimal(order.totalAmount),
      adjustmentRemark: order.adjustmentRemark || '',
      adjustments: order.adjustments.map(formatOrderAdjustment),
      items: order.items.map(item => ({
        goodsName: item.goodsName,
        quantity: formatDecimal(item.quantity),
        weight: item.weight ? formatDecimal(item.weight) : null,
        price: formatDecimal(item.price),
        commission: formatDecimal(item.commission),
        subtotal: formatDecimal(item.subtotal)
      }))
    }
  } else {
    if (!Array.isArray(body?.items) || body.items.length === 0) {
      throw createError({ statusCode: 400, statusMessage: '打印内容不能为空' })
    }
    const adjustments = buildOrderAdjustments(body?.adjustments)
    const goodsAmount = Number(body.items.reduce((sum: number, item: any) => {
      return sum + Number(item?.subtotal || 0)
    }, 0).toFixed(2))
    const totalAmount = Number((goodsAmount + sumOrderAdjustments(adjustments)).toFixed(2))
    if (totalAmount < 0) {
      throw createError({ statusCode: 400, statusMessage: '订单总金额不能小于0' })
    }

    printOrder = {
      orderNo: String(body?.orderNo || ''),
      customerName: String(body?.customerName || '客户'),
      staffName: String(body?.staffName || staff.name || ''),
      createdAt: body?.createdAt || new Date(),
      totalAmount,
      adjustmentRemark: parseOrderAdjustmentRemark(body?.adjustmentRemark ?? body?.remark),
      adjustments: adjustments.map(formatOrderAdjustment),
      items: body.items
    }
  }

  const content = buildXpyunReceipt(printOrder)
  try {
    const result = await sendXpyunPrint(content)
    await savePrintRecord({
      type: 'order',
      status: 'success',
      staffId: staff.id,
      staffName: staff.name,
      orderId: orderId > 0 ? orderId : null,
      orderNo: printOrder.orderNo || null,
      customerName: printOrder.customerName || null,
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
      type: 'order',
      status: 'failed',
      staffId: staff.id,
      staffName: staff.name,
      orderId: orderId > 0 ? orderId : null,
      orderNo: printOrder.orderNo || null,
      customerName: printOrder.customerName || null,
      content,
      errorMessage: getPrintErrorMessage(error)
    })
    throw error
  }
})
