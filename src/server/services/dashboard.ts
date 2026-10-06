import { Prisma, type PrismaClient } from "@prisma/client";
import { db as defaultDb } from "@/server/db";
import type { TenantContext } from "@/server/tenant";

/** Inventory snapshot for the dashboard. Sales metrics arrive with the POS module. */
export async function getInventorySummary(ctx: TenantContext, db: PrismaClient = defaultDb) {
  const [row] = await db.$queryRaw<
    {
      products: bigint;
      value_at_cost: Prisma.Decimal | null;
      value_at_price: Prisma.Decimal | null;
      low_stock: bigint;
    }[]
  >`
    SELECT
      COUNT(*)                                             AS products,
      SUM(GREATEST(stock, 0) * cost)                       AS value_at_cost,
      SUM(GREATEST(stock, 0) * "salePrice")                AS value_at_price,
      COUNT(*) FILTER (WHERE stock <= "minStock")          AS low_stock
    FROM "Product"
    WHERE "businessId" = ${ctx.businessId} AND active = true
  `;
  return {
    products: Number(row?.products ?? 0),
    valueAtCost: new Prisma.Decimal(row?.value_at_cost ?? 0),
    valueAtPrice: new Prisma.Decimal(row?.value_at_price ?? 0),
    lowStock: Number(row?.low_stock ?? 0),
  };
}
