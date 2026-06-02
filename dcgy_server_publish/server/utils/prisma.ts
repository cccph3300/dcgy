import { PrismaClient } from '@prisma/client'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

declare global {
  // 开发环境热更新会重复加载模块，挂到 globalThis 避免创建过多连接。
  // eslint-disable-next-line no-var
  var __dcgyPrisma: PrismaClient | undefined
}

function loadEnvFallback() {
  if (process.env.DATABASE_URL) return

  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match || process.env[match[1]] !== undefined) continue

    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] = value
  }
}

loadEnvFallback()

export const prisma = globalThis.__dcgyPrisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__dcgyPrisma = prisma
}
