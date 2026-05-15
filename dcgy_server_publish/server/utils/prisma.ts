import { PrismaClient } from '@prisma/client'

declare global {
  // 开发环境热更新会重复加载模块，挂到 globalThis 避免创建过多连接。
  // eslint-disable-next-line no-var
  var __dcgyPrisma: PrismaClient | undefined
}

export const prisma = globalThis.__dcgyPrisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__dcgyPrisma = prisma
}
