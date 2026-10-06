import { PrismaClient } from "@prisma/client";
import { env } from "@/env";

// Single PrismaClient per process (avoids exhausting connections on hot reload).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: env.DATABASE_URL });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
