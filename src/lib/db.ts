import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Build connection URL with ?pgbouncer=true to disable prepared statements.
// This fixes the PgBouncer "prepared statement already exists" (42P05) error
// while still using the pooler connection which Vercel can reach.
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || ''
  // If already has pgbouncer param, return as-is
  if (url.includes('pgbouncer=true')) return url
  // Append pgbouncer=true to disable prepared statements
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}pgbouncer=true`
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    datasourceUrl: getDatabaseUrl(),
  })

// Always cache the PrismaClient singleton — prevents 42P05 errors in development
// when hot-reload creates multiple PrismaClient instances behind PgBouncer.
if (!globalForPrisma.prisma) globalForPrisma.prisma = db
