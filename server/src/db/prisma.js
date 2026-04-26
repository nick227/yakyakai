import { PrismaClient } from '@prisma/client'

export const prisma = globalThis.__yakyakaiPrisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__yakyakaiPrisma = prisma
}
