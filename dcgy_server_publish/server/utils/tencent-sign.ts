import { createHash, createHmac } from 'node:crypto'
import { createError } from 'h3'

type TencentHeaderOptions = {
  host: string
  service: string
  action: string
  version: string
  region: string
  payload: string
}

export function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim().replace(/^["']|["']$/g, '')
  if (!value) {
    throw createError({ statusCode: 500, statusMessage: `缺少配置：${name}` })
  }
  return value
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function hmacSha256(key: string | Buffer, value: string) {
  return createHmac('sha256', key).update(value).digest()
}

export function createTencentJsonHeaders(options: TencentHeaderOptions) {
  const secretId = getRequiredEnv('TENCENT_SECRET_ID')
  const secretKey = getRequiredEnv('TENCENT_SECRET_KEY')

  if (!secretId.startsWith('AKID')) {
    throw createError({
      statusCode: 500,
      statusMessage: '腾讯云配置错误：TENCENT_SECRET_ID 应该是 AKID 开头的 SecretId'
    })
  }

  if (secretKey.startsWith('AKID')) {
    throw createError({
      statusCode: 500,
      statusMessage: '腾讯云配置错误：TENCENT_SECRET_KEY 填成了 SecretId，请填写对应的 SecretKey'
    })
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8\nhost:${options.host}\nx-tc-action:${options.action.toLowerCase()}\n`,
    'content-type;host;x-tc-action',
    sha256(options.payload)
  ].join('\n')
  const credentialScope = `${date}/${options.service}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n')
  const secretDate = hmacSha256(`TC3${secretKey}`, date)
  const secretService = hmacSha256(secretDate, options.service)
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
    Host: options.host,
    'X-TC-Action': options.action,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': options.version,
    'X-TC-Region': options.region
  }
}
