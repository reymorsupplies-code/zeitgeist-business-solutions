import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    // Use DIRECT_URL in production (Vercel serverless) to avoid PgBouncer 42P05
    // "prepared statement already exists" errors. Serverless functions have
    // low concurrency per-instance so the direct pool is fine.
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

// Always cache the PrismaClient singleton — prevents 42P05 errors in development
// when hot-reload creates multiple PrismaClient instances behind PgBouncer.
if (!globalForPrisma.prisma) globalForPrisma.prisma = db
