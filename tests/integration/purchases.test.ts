import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import { createProduct, findProductByBarcode } from "@/server/services/products";
import { createPurchase } from "@/server/services/purchases";
import type { TenantContext } from "@/server/tenant";
import { createTenant, deleteTenant } from "./helpers";

let a: TenantContext;
let b: TenantContext;

beforeAll(async () => {
  a = await createTenant("A");
  b = await createTenant("B");
});

afterAll(async () => {
  await deleteTenant(a);
  await deleteTenant(b);
  await db.$disconnect();
});

let seq = 0;
const mk = (ctx: TenantContext, over: { cost?: string; initialStock?: string } = {}) =>
  createProduct(ctx, { name: `P${seq++}`, salePrice: "5000", cost: over.cost ?? "1000", ...over });
const unit = (productId: string, quantity: string, cost: string) => ({ productId, quantity, costMode: "unit", cost });

describe("createPurchase", () => {
  it("saves purchase, items, stock and one COMPRA movement per line", async () => {
    const p1 = await mk(a);
    const p2 = await mk(a);
    const purchase = await createPurchase(a, {
      lines: [unit(p1.id, "10", "1000"), { productId: p2.id, quantity: "4", costMode: "total", cost: "2500,50" }],
    });

    expect(purchase.total.toString()).toBe("12500.5");
    const saved = await db.purchase.findUniqueOrThrow({ where: { id: purchase.id }, include: { items: true } });
    expect(saved).toMatchObject({ businessId: a.businessId, userId: a.userId, supplierId: null, invoiceRef: null });
    expect(saved.items).toHaveLength(2);

    const movements = await db.inventoryMovement.findMany({ where: { reference: purchase.id } });
    expect(movements).toHaveLength(2);
    for (const m of movements) {
      expect(m).toMatchObject({ type: "COMPRA", businessId: a.businessId, userId: a.userId });
      expect(m.quantity.gt(0)).toBe(true);
    }
    const m2 = movements.find((m) => m.productId === p2.id)!;
    expect(m2.quantity.toString()).toBe("4");
    expect(m2.unitCost.toString()).toBe("625.125");
    expect((await db.product.findUniqueOrThrow({ where: { id: p1.id } })).stock.toString()).toBe("10");
    expect((await db.product.findUniqueOrThrow({ where: { id: p2.id } })).stock.toString()).toBe("4");
  });

  it("computes the weighted average cost when stock > 0", async () => {
    const p = await mk(a, { cost: "1000", initialStock: "10" });
    await createPurchase(a, { lines: [unit(p.id, "10", "2000")] });
    const after = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stock.toString()).toBe("20");
    expect(after.cost.toString()).toBe("1500");
  });

  it("takes the entered cost when stock is 0 or negative", async () => {
    const zero = await mk(a, { cost: "1000" });
    const neg = await mk(a, { cost: "1000" });
    await db.product.update({ where: { id: neg.id }, data: { stock: -3 } });
    await createPurchase(a, { lines: [unit(zero.id, "5", "300"), unit(neg.id, "5", "400")] });
    const z = await db.product.findUniqueOrThrow({ where: { id: zero.id } });
    const n = await db.product.findUniqueOrThrow({ where: { id: neg.id } });
    expect(z.cost.toString()).toBe("300");
    expect(n.cost.toString()).toBe("400");
    expect(n.stock.toString()).toBe("2");
  });

  it("uses total / quantity in batch-total mode", async () => {
    const p = await mk(a);
    await createPurchase(a, { lines: [{ productId: p.id, quantity: "3", costMode: "total", cost: "10" }] });
    const after = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.cost.toString()).toBe("3.3333");
  });

  it("accepts an inactive product and reactivates it", async () => {
    const p = await mk(a);
    await db.product.update({ where: { id: p.id }, data: { active: false } });
    await createPurchase(a, { lines: [unit(p.id, "1", "1000")] });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).active).toBe(true);
  });

  it("rejects empty purchases, invalid input and repeated products", async () => {
    const p = await mk(a);
    await expect(createPurchase(a, { lines: [] })).rejects.toBeInstanceOf(ZodError);
    await expect(createPurchase(a, { lines: [unit(p.id, "1.5", "10")] })).rejects.toBeInstanceOf(ZodError);
    await expect(createPurchase(a, { lines: [unit(p.id, "1", "10"), unit(p.id, "2", "10")] })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it("rolls everything back when one line has an invalid product", async () => {
    const p = await mk(a);
    const purchasesBefore = await db.purchase.count({ where: { businessId: a.businessId } });
    const movementsBefore = await db.inventoryMovement.count({ where: { businessId: a.businessId } });
    await expect(
      createPurchase(a, { lines: [unit(p.id, "5", "2000"), unit("does-not-exist", "1", "10")] }),
    ).rejects.toThrow("Producto no válido");
    expect(await db.purchase.count({ where: { businessId: a.businessId } })).toBe(purchasesBefore);
    expect(await db.inventoryMovement.count({ where: { businessId: a.businessId } })).toBe(movementsBefore);
    const after = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stock.toString()).toBe("0");
    expect(after.cost.toString()).toBe("1000");
  });

  it("rolls back and reports a Spanish error when stock would overflow", async () => {
    const p = await mk(a);
    await db.product.update({ where: { id: p.id }, data: { stock: "999999999" } });
    await expect(createPurchase(a, { lines: [unit(p.id, "1", "10")] })).rejects.toBeInstanceOf(DomainError);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock.toString()).toBe("999999999");
  });
});

describe("acceptance", () => {
  it("AC2: each product gets a COMPRA movement with the quantity and the cost entered", async () => {
    const p1 = await mk(a, { cost: "1000", initialStock: "10" });
    const p2 = await mk(a);
    const purchase = await createPurchase(a, { lines: [unit(p1.id, "6", "2000,5"), unit(p2.id, "2", "300")] });

    const movements = await db.inventoryMovement.findMany({
      where: { type: "COMPRA", reference: purchase.id },
    });
    expect(movements).toHaveLength(2);
    const m1 = movements.find((m) => m.productId === p1.id)!;
    const m2 = movements.find((m) => m.productId === p2.id)!;
    expect(m1.quantity.toString()).toBe("6");
    expect(m1.unitCost.toString()).toBe("2000.5");
    expect(m2.quantity.toString()).toBe("2");
    expect(m2.unitCost.toString()).toBe("300");
  });
});

describe("tenant isolation", () => {
  it("business B cannot buy A's product and A's data is unchanged", async () => {
    const p = await createProduct(a, { name: "Solo A", salePrice: "5000", cost: "1000", barcode: "2000000000001" });
    await expect(createPurchase(b, { lines: [unit(p.id, "5", "10")] })).rejects.toThrow("Producto no válido");
    const after = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stock.toString()).toBe("0");
    expect(after.cost.toString()).toBe("1000");
    expect(await db.purchase.count({ where: { businessId: b.businessId } })).toBe(0);
    expect(await findProductByBarcode(b, "2000000000001")).toBeNull();
  });
});

describe("concurrency", () => {
  it("two concurrent purchases of the same product keep stock and cost consistent", async () => {
    const p = await mk(a, { cost: "1000", initialStock: "10" });
    await Promise.all([
      createPurchase(a, { lines: [unit(p.id, "10", "2000")] }),
      createPurchase(a, { lines: [unit(p.id, "20", "3000")] }),
    ]);
    const after = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stock.toString()).toBe("40");
    // Either order yields a different average; it must match one serial order.
    // 10@1000 -> +10@2000 = 1500 (20) -> +20@3000 = 2250 ; or +20@3000 = 2333.3333 (30) -> +10@2000 = 2250
    expect(after.cost.toString()).toBe("2250");
    expect(await db.inventoryMovement.count({ where: { productId: p.id, type: "COMPRA" } })).toBe(2);
  });
});
