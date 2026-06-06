import { PrismaClient } from '../generated/prisma/client';

const createClient = () => new (PrismaClient as any)() as PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
