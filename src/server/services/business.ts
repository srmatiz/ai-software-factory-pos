import type { PrismaClient } from "@prisma/client";
import { db as defaultDb } from "@/server/db";
import type { TenantContext } from "@/server/tenant";

export async function getBusiness(ctx: TenantContext, db: PrismaClient = defaultDb) {
  return db.business.findUniqueOrThrow({ where: { id: ctx.businessId } });
}
