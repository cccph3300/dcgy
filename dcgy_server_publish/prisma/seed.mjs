import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'

const prisma = new PrismaClient()

function hashPassword(password) {
  return createHash('sha256').update(`dcgy:${password}`).digest('hex')
}

const username = process.env.SEED_STAFF_USERNAME || 'admin'
const password = process.env.SEED_STAFF_PASSWORD || '123456'
const name = process.env.SEED_STAFF_NAME || '老板'

await prisma.staffUser.upsert({
  where: { username },
  update: { name, enabled: true },
  create: {
    username,
    name,
    passwordHash: hashPassword(password)
  }
})

await prisma.$disconnect()

console.log(`已准备初始店员账号：${username}`)
