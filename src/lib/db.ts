import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Prisma 7: constructor types require adapter/accelerateUrl but runtime reads DATABASE_URL
export const db = globalForPrisma.prisma ?? new (PrismaClient as any)() as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
