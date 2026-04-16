import { PrismaClient } from '@prisma/client'

// BigInt JSON serialization support
// Prisma returns BigInt for volume fields - JSON.stringify cannot handle BigInt natively
if (typeof BigInt !== 'undefined') {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this)
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Append connection pool params if not already present
function getDatasourceUrl() {
  const url = process.env.DATABASE_URL ?? ''
  if (!url) return url
  const separator = url.includes('?') ? '&' : '?'
  // connection_limit=10 to handle concurrent requests, pool_timeout=20 for more waiting room
  if (url.includes('connection_limit')) return url
  return `${url}${separator}connection_limit=10&pool_timeout=20`
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'],
  datasourceUrl: getDatasourceUrl(),
})

// Keep singleton in dev to avoid too many connections during hot reload
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
// Also keep in production to reuse across requests
if (process.env.NODE_ENV === 'production') globalForPrisma.prisma = prisma
