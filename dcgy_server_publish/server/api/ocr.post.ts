import { createHash, createHmac } from 'node:crypto'
import { createError, getHeader, readBody, readMultipartFormData } from 'h3'
import type { H3Event } from 'h3'

const TENCENT_OCR_HOST = 'ocr.tencentcloudapi.com'
const TENCENT_OCR_ENDPOINT = `https://${TENCENT_OCR_HOST}`
const TENCENT_OCR_SERVICE = 'ocr'
const TENCENT_OCR_VERSION = '2018-11-19'

type TencentOcrWord = {
  DetectedText?: string
}

type TencentOcrResponse = {
  Response?: {
    TextDetections?: TencentOcrWord[]
    Error?: {
      Code?: string
      Message?: string
    }
    RequestId?: string
  }
}

function getEnv(name: string) {
  const value = process.env[name]?.trim().replace(/^["']|["']$/g, '')
  if (!value) {
    throw createError({ statusCode: 500, statusMessage: `缺少腾讯云 OCR 配置：${name}` })
  }
  return value
}

function getTencentCredential() {
  const secretId = getEnv('TENCENT_SECRET_ID')
  const secretKey = getEnv('TENCENT_SECRET_KEY')

  if (!secretId.startsWith('AKID')) {
    throw createError({
      statusCode: 500,
      statusMessage: '腾讯云 OCR 配置错误：TENCENT_SECRET_ID 应该是 AKID 开头的 SecretId，不是 AppID'
    })
  }

  if (secretKey.startsWith('AKID')) {
    throw createError({
      statusCode: 500,
      statusMessage: '腾讯云 OCR 配置错误：TENCENT_SECRET_KEY 填成了 SecretId，请填写对应的 SecretKey'
    })
  }

  return { secretId, secretKey }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function hmacSha256(key: string | Buffer, value: string) {
  return createHmac('sha256', key).update(value).digest()
}

function normalizeBase64(value: string) {
  const match = value.match(/^data:[^;]+;base64,(.+)$/)
  return (match ? match[1] : value).replace(/\s/g, '')
}

async function readImageBase64(event: H3Event) {
  const contentType = String(getHeader(event, 'content-type') || '').toLowerCase()

  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    const file = parts?.find(part => part.name === 'file' || part.filename)
    if (!file?.data?.length) return ''
    return Buffer.from(file.data).toString('base64')
  }

  const body = await readBody<{ imageBase64?: string }>(event)
  return String(body?.imageBase64 || '')
}

function createTencentAuthHeaders(action: string, payload: string) {
  const { secretId, secretKey } = getTencentCredential()
  const region = process.env.TENCENT_OCR_REGION?.trim() || 'ap-guangzhou'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)

  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8\nhost:${TENCENT_OCR_HOST}\nx-tc-action:${action.toLowerCase()}\n`,
    'content-type;host;x-tc-action',
    sha256(payload)
  ].join('\n')

  const credentialScope = `${date}/${TENCENT_OCR_SERVICE}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n')

  const secretDate = hmacSha256(`TC3${secretKey}`, date)
  const secretService = hmacSha256(secretDate, TENCENT_OCR_SERVICE)
  const secretSigning = hmacSha256(secretService, 'tc3_request')
  const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex')
  const authorization = [
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}`,
    'SignedHeaders=content-type;host;x-tc-action',
    `Signature=${signature}`
  ].join(', ')

  return {
    Authorization: authorization,
    'Content-Type': 'application/json; charset=utf-8',
    Host: TENCENT_OCR_HOST,
    'X-TC-Action': action,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': TENCENT_OCR_VERSION,
    'X-TC-Region': region
  }
}

async function callTencentOcr(imageBase64: string) {
  const action = process.env.TENCENT_OCR_ACTION?.trim() || 'GeneralBasicOCR'
  const payload = JSON.stringify({ ImageBase64: normalizeBase64(imageBase64) })
  const response = await fetch(TENCENT_OCR_ENDPOINT, {
    method: 'POST',
    headers: createTencentAuthHeaders(action, payload),
    body: payload
  })
  const result = await response.json().catch(() => null) as TencentOcrResponse | null
  const error = result?.Response?.Error

  if (!response.ok || error || !result?.Response) {
    throw createError({
      statusCode: response.ok ? 502 : response.status,
      statusMessage: error?.Message || '腾讯云 OCR 识别失败'
    })
  }

  return result.Response.TextDetections || []
}

export default defineEventHandler(async (event) => {
  const imageBase64 = await readImageBase64(event)

  if (!imageBase64) {
    throw createError({ statusCode: 400, statusMessage: '图片不能为空' })
  }

  const texts = (await callTencentOcr(imageBase64))
    .map(item => String(item.DetectedText || '').trim())
    .filter(Boolean)

  return {
    success: true,
    text: texts.join('\n'),
    texts
  }
})
