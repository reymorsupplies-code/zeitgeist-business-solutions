import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    datasourceUrl: process.env.DATABASE_URL,
  })

// Always cache the PrismaClient singleton — prevents 42P05 errors in production
// when behind PgBouncer (Supabase), where recycled connections carry stale
// prepared statements from other PrismaClient instances.
if (!globalForPrisma.prisma) globalForPrisma.prisma = db
