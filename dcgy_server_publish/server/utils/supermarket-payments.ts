import { createError } from 'h3'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { formatDecimal } from './number'

type PrismaExecutor = Prisma.TransactionClient | typeof prisma

export async function ensureSupermarketAccount(name: string, tx: PrismaExecutor = prisma) {
  const supermarketName = String(name || '').trim()
  if (!supermarketName) {
    throw createError({ statusCode: 400, statusMessage: '请传入超市名称' })
  }

  const existing = await tx.supermarketAccount.findUnique({
    where: { name: supermarketName },
    select: { id: true, name: true, partialPayment: true, totalDebt: true }
  })
  if (existing) return existing

  const totalDebt = await getSupermarketActiveOrderTotal(supermarketName, tx)
  return tx.supermarketAccount.create({
    data: {
      name: supermarketName,
      totalDebt,
      partialPayment: 0
    },
    select: { id: true, name: true, partialPayment: true, totalDebt: true }
  })
}

export async function getSupermarketActiveOrderTotal(name: string, tx: PrismaExecutor = prisma) {
  const result = await tx.supermarketOrder.aggregate({
    where: {
      supermarketName: name,
      status: 'active'
    },
    _sum: { totalAmount: true }
  })
  return formatDecimal(result._sum.totalAmount || 0)
}

export async function recalculateSupermarketDebt(name: string, tx: PrismaExecutor = prisma) {
  const account = await ensureSupermarketAccount(name, tx)
  const orders = await tx.supermarketOrder.findMany({
    where: {
      supermarketName: name,
      status: 'active'
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    select: {
      id: true,
      totalAmount: true,
      partialPayment: true
    }
  })

  const totalDebt = formatDecimal(orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0))
  let allocatedPartialPayment = 0
  let availablePartialPayment = formatDecimal(account.partialPayment || 0)
  for (const order of orders) {
    const totalAmount = formatDecimal(order.totalAmount || 0)
    const currentPartialPayment = formatDecimal(order.partialPayment || 0)
    const cappedPartialPayment = formatDecimal(Math.min(currentPartialPayment, totalAmount))
    if (cappedPartialPayment !== currentPartialPayment) {
      await tx.supermarketOrder.update({
        where: { id: order.id },
        data: { partialPayment: cappedPartialPayment }
      })
      availablePartialPayment = formatDecimal(availablePartialPayment + currentPartialPayment - cappedPartialPayment)
    }
    allocatedPartialPayment += cappedPartialPayment
  }

  allocatedPartialPayment = formatDecimal(allocatedPartialPayment)
  availablePartialPayment = Math.min(availablePartialPayment, Math.max(totalDebt - allocatedPartialPayment, 0))
  await tx.supermarketAccount.update({
    where: { id: account.id },
    data: {
      totalDebt,
      partialPayment: availablePartialPayment
    }
  })

  return totalDebt
}

export async function getSupermarketUnpaidAmount(name: string, tx: PrismaExecutor = prisma) {
  const account = await ensureSupermarketAccount(name, tx)
  const result = await tx.supermarketOrder.aggregate({
    where: {
      supermarketName: name,
      status: 'active'
    },
    _sum: {
      totalAmount: true,
      partialPayment: true
    }
  })
  const totalAmount = Number(result._sum.totalAmount || 0)
  const orderPartialPayment = Number(result._sum.partialPayment || 0)
  const accountPartialPayment = Number(account.partialPayment || 0)
  return formatDecimal(Math.max(totalAmount - orderPartialPayment - accountPartialPayment, 0))
}
