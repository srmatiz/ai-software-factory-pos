import { Prisma, type PrismaClient } from "@prisma/client";
import { db as defaultDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import type { TenantContext } from "@/server/tenant";
import { weightedAverageCost } from "@/lib/money";
import { lineUnitCost, purchaseTotal } from "@/lib/purchase";
import { createPurchaseSchema, type CreatePurchaseInput } from "@/lib/schemas/purchase";

type Db = PrismaClient;

const MAX_STOCK = new Prisma.Decimal("999999999.999"); // Decimal(12,3)
const MAX_COST = new Prisma.Decimal("99999999.9999"); // Decimal(12,4)

type LockedProduct = { id: string; stock: Prisma.Decimal; cost: Prisma.Decimal };

/**
 * Receives stock: one Purchase with its items, one COMPRA movement per line,
 * stock increase and weighted-average cost, all in a single transaction.
 * Products are locked (FOR UPDATE, ordered by id) so concurrent purchases
 * compute the average cost from consistent values.
 */
export async function createPurchase(ctx: TenantContext, raw: CreatePurchaseInput | unknown, db: Db = defaultDb) {
  const input = createPurchaseSchema.parse(raw);

  const ids = input.lines.map((l) => l.productId);
  if (new Set(ids).size !== ids.length) {
    throw new DomainError("Un producto no puede repetirse en la misma compra");
  }

  const lines = input.lines.map((l) => ({ ...l, qty: new Prisma.Decimal(l.quantity) }));
  const total = new Prisma.Decimal(purchaseTotal(input.lines).toString());

  try {
    return await db.$transaction(async (tx) => {
      const sortedIds = [...ids].sort();
      const rows = await tx.$queryRaw<{ id: string; stock: unknown; cost: unknown }[]>`
        SELECT id, stock, cost FROM "Product"
        WHERE "businessId" = ${ctx.businessId} AND id = ANY(${sortedIds})
        ORDER BY id FOR UPDATE`;
      if (rows.length !== ids.length) throw new DomainError("Producto no válido");

      const locked = new Map<string, LockedProduct>(
        rows.map((r) => [
          r.id,
          { id: r.id, stock: new Prisma.Decimal(String(r.stock)), cost: new Prisma.Decimal(String(r.cost)) },
        ]),
      );

      const purchase = await tx.purchase.create({
        data: { businessId: ctx.businessId, userId: ctx.userId, total },
      });

      for (const line of lines) {
        const product = locked.get(line.productId)!;
        const unitCost = new Prisma.Decimal(lineUnitCost(line).toString());
        const newCost = new Prisma.Decimal(
          weightedAverageCost(product.stock, product.cost, line.qty, unitCost).toString(),
        );
        if (product.stock.plus(line.qty).gt(MAX_STOCK) || newCost.gt(MAX_COST) || unitCost.gt(MAX_COST)) {
          throw new DomainError("La compra supera el límite de stock o costo permitido");
        }

        await tx.product.update({
          where: { id: product.id },
          data: { stock: { increment: line.qty }, cost: newCost, active: true },
        });
        await tx.purchaseItem.create({
          data: { purchaseId: purchase.id, productId: product.id, quantity: line.qty, unitCost },
        });
        await tx.inventoryMovement.create({
          data: {
            businessId: ctx.businessId,
            productId: product.id,
            userId: ctx.userId,
            type: "COMPRA",
            quantity: line.qty,
            unitCost,
            reference: purchase.id,
          },
        });
      }

      return { id: purchase.id, total: purchase.total };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2020") {
      throw new DomainError("La compra supera el límite de stock o costo permitido");
    }
    throw e;
  }
}
