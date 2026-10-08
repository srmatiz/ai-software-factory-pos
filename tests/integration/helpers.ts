import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenant";

/** Creates an isolated business + admin user and returns its tenant context. */
export async function createTenant(name = "Test"): Promise<TenantContext> {
  const business = await db.business.create({ data: { name: `${name} ${randomUUID()}` } });
  const user = await db.user.create({
    data: {
      businessId: business.id,
      email: `${randomUUID()}@test.local`,
      name: "Tester",
      passwordHash: "x",
      role: "ADMIN",
    },
  });
  return { businessId: business.id, userId: user.id, role: "ADMIN" };
}

export async function deleteTenant(ctx: TenantContext) {
  const where = { businessId: ctx.businessId };
  await db.purchaseItem.deleteMany({ where: { purchase: where } });
  await db.purchase.deleteMany({ where });
  await db.inventoryMovement.deleteMany({ where });
  await db.product.deleteMany({ where });
  await db.category.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.business.delete({ where: { id: ctx.businessId } });
}
