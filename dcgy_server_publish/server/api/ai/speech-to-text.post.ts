import { createError, readBody } from 'h3'
import { requireStaff } from '../../utils/auth'
import { createTencentJsonHeaders } from '../../utils/tencent-sign'

const TENCENT_ASR_HOST = 'asr.tencentcloudapi.com'
const TENCENT_ASR_ENDPOINT = `https://${TENCENT_ASR_HOST}`
const TENCENT_ASR_SERVICE = 'asr'
const TENCENT_ASR_VERSION = '2019-06-14'

type TencentAsrResponse = {
  Response?: {
    Result?: string
    AudioDuration?: number
    Error?: {
      Code?: string
      Message?: string
    }
    RequestId?: string
  }
}

const SUPPORTED_VOICE_FORMATS = new Set([
  'wav',
  'pcm',
  'ogg-opus',
  'speex',
  'silk',
  'mp3',
  'm4a',
  'aac',
  'amr'
])

function normalizeBase64(value: string) {
  const match = value.match(/^data:[^;]+;base64,(.+)$/)
  return (match ? match[1] : value).replace(/\s/g, '')
}

function decodeAudioData(base64: string) {
  const normalized = normalizeBase64(base64)
  if (!normalized) return Buffer.alloc(0)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw createError({ statusCode: 400, statusMessage: '音频 Base64 格式不正确' })
  }
  return Buffer.from(normalized, 'base64')
}

function getVoiceFormat(value: unknown) {
  const raw = String(value || '').toLowerCase().trim()
  if (raw.includes('ogg') || raw.includes('opus')) return 'ogg-opus'
  if (raw.includes('wav')) return 'wav'
  if (raw.includes('m4a') || raw.includes('mp4')) return 'm4a'
  if (raw.includes('aac')) return 'aac'
  if (raw.includes('amr')) return 'amr'
  if (raw.includes('silk')) return 'silk'
  if (raw.includes('speex')) return 'speex'
  if (raw.includes('pcm')) return 'pcm'
  if (raw.includes('mp3') || raw.includes('mpeg')) return 'mp3'
  return 'aac'
}

function normalizeAudioKey(value: unknown) {
  const raw = String(value || '').trim()
  return raw.replace(/[^\w.-]/g, '').slice(0, 64) || `dcgy-${Date.now()}`
}

async function callTencentAsr(options: { audioBase64: string, voiceFormat: string, audioKey?: string }) {
  const audioData = decodeAudioData(options.audioBase64)
  if (!audioData.length) {
    throw createError({ statusCode: 400, statusMessage: '音频不能为空' })
  }
  if (audioData.length > 5 * 1024 * 1024) {
    throw createError({ statusCode: 413, statusMessage: '音频不能超过 5MB，请缩短录音时间' })
  }

  const voiceFormat = getVoiceFormat(options.voiceFormat)
  if (!SUPPORTED_VOICE_FORMATS.has(voiceFormat)) {
    throw createError({ statusCode: 400, statusMessage: `暂不支持该音频格式：${voiceFormat}` })
  }

  const payload = JSON.stringify({
    ProjectId: 0,
    SubServiceType: 2,
    EngSerViceType: process.env.TENCENT_ASR_ENGINE_TYPE?.trim() || '16k_zh',
    SourceType: 1,
    VoiceFormat: voiceFormat,
    UsrAudioKey: normalizeAudioKey(options.audioKey),
    Data: audioData.toString('base64'),
    DataLen: audioData.length
  })
  const region = process.env.TENCENT_ASR_REGION?.trim() || 'ap-guangzhou'
  const response = await fetch(TENCENT_ASR_ENDPOINT, {
    method: 'POST',
    headers: createTencentJsonHeaders({
      host: TENCENT_ASR_HOST,
      service: TENCENT_ASR_SERVICE,
      action: 'SentenceRecognition',
      version: TENCENT_ASR_VERSION,
      region,
      payload
    }),
    body: payload
  })
  const result = await response.json().catch(() => null) as TencentAsrResponse | null
  const error = result?.Response?.Error

  if (!response.ok || error || !result?.Response) {
    throw createError({
      statusCode: response.ok ? 502 : response.status,
      statusMessage: error?.Message || '腾讯云语音识别失败',
      data: {
        code: error?.Code,
        requestId: result?.Response?.RequestId
      }
    })
  }

  return {
    text: String(result.Response.Result || '').trim(),
    audioDuration: result.Response.AudioDuration || 0,
    voiceFormat
  }
}

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const body = await readBody(event)
  const audioBase64 = String(body?.audioBase64 || '').trim()

  if (!audioBase64) {
    throw createError({ statusCode: 400, statusMessage: '音频不能为空' })
  }

  const result = await callTencentAsr({
    audioBase64,
    voiceFormat: String(body?.voiceFormat || ''),
    audioKey: String(body?.audioKey || '')
  })

  return {
    success: true,
    ...result
  }
})
