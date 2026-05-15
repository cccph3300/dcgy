import { prisma } from './prisma'

type PrintRecordStatus = 'success' | 'failed'
type PrintRecordType = 'order' | 'customer_debt'

type SavePrintRecordInput = {
  type: PrintRecordType
  status: PrintRecordStatus
  staffId: number
  staffName: string
  content: string
  orderId?: number | null
  orderNo?: string | null
  customerId?: number | null
  customerName?: string | null
  response?: unknown
  errorMessage?: string | null
}

function getPrinterSn() {
  return process.env.XPYUN_SN?.trim() || null
}

export function getPrintErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500)
  }
  return String(error || '打印失败').slice(0, 500)
}

export async function savePrintRecord(input: SavePrintRecordInput) {
  try {
    await prisma.printRecord.create({
      data: {
        type: input.type,
        status: input.status,
        staffId: input.staffId,
        staffName: input.staffName,
        orderId: input.orderId || null,
        orderNo: input.orderNo || null,
        customerId: input.customerId || null,
        customerName: input.customerName || null,
        printerSn: getPrinterSn(),
        content: input.content,
        response: input.response === undefined ? undefined : input.response,
        errorMessage: input.errorMessage || null
      }
    })
  } catch (error) {
    // 打印记录不能反向影响打印主流程，避免因日志表异常导致用户无法补打。
    console.error('保存打印记录失败', error)
  }
}
