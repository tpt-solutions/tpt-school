import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'node:path'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
  const dbPath = dbUrl.replace(/^file:/, '')
  const resolvedPath = path.isAbsolute(dbPath)
    ? dbPath
    : path.join(process.cwd(), dbPath)

  const adapter = new PrismaBetterSqlite3({ url: resolvedPath })
  return new (PrismaClient as any)({ adapter }) as PrismaClient
}

export const db: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = createClient())

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
