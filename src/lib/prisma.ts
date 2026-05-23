import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrismaClient(): PrismaClient {
  let url = process.env.DATABASE_URL ?? 'file:./prisma/ana.db'
  // Em modo Electron, forçar o caminho do userData independentemente do DATABASE_URL
  if (process.env.ELECTRON_USER_DATA) {
    const dbFile = path.join(process.env.ELECTRON_USER_DATA, 'ana.db').replace(/\\/g, '/')
    url = `file:${dbFile}`
  }
  const adapter = new PrismaLibSql({ url })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
