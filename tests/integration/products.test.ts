import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import {
  createProduct,
  findProductByBarcode,
  getProduct,
  listProducts,
  updateProduct,
} from "@/server/services/products";
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

const base = { name: "Agua 600ml", salePrice: "2500", cost: "1200" };

describe("createProduct", () => {
  it("stores sale price and acquisition cost, and records opening stock in the kardex at that cost", async () => {
    const p = await createProduct(a, { ...base, barcode: "1000000000001", initialStock: "10" });

    expect(p.salePrice.toString()).toBe("2500");
    expect(p.cost.toString()).toBe("1200");
    expect(p.stock.toString()).toBe("10");

    const movements = await db.inventoryMovement.findMany({ where: { productId: p.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: "INICIAL", businessId: a.businessId, userId: a.userId });
    expect(movements[0].quantity.toString()).toBe("10");
    expect(movements[0].unitCost.toString()).toBe("1200");
  });

  it("does not create a movement when there is no opening stock", async () => {
    const p = await createProduct(a, { ...base, barcode: "1000000000002" });
    expect(p.stock.toString()).toBe("0");
    expect(await db.inventoryMovement.count({ where: { productId: p.id } })).toBe(0);
  });

  it("requires sale price and cost", async () => {
    await expect(createProduct(a, { name: "Sin precio", cost: "100" })).rejects.toBeInstanceOf(ZodError);
    await expect(createProduct(a, { name: "Sin costo", salePrice: "100" })).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects a duplicate barcode within the same business", async () => {
    await createProduct(a, { ...base, barcode: "1000000000003" });
    const err = await createProduct(a, { ...base, barcode: "1000000000003" }).catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.field).toBe("barcode");
  });

  it("allows the same barcode in a different business", async () => {
    await createProduct(a, { ...base, barcode: "1000000000004" });
    await expect(createProduct(b, { ...base, barcode: "1000000000004" })).resolves.toBeTruthy();
  });

  it("rejects a category that belongs to another business", async () => {
    const foreign = await db.category.create({ data: { businessId: b.businessId, name: "Ajena" } });
    await expect(createProduct(a, { ...base, categoryId: foreign.id })).rejects.toThrow("Categoría no válida");
  });
});

describe("tenant isolation", () => {
  it("never returns or updates another business's products", async () => {
    const p = await createProduct(a, { ...base, name: "Solo de A", barcode: "1000000000005" });

    expect(await getProduct(b, p.id)).toBeNull();
    expect(await findProductByBarcode(b, "1000000000005")).toBeNull();
    expect((await listProducts(b, { q: "Solo de A" })).map((x) => x.id)).not.toContain(p.id);
    await expect(updateProduct(b, p.id, { ...base, name: "Hackeado" })).rejects.toThrow("Producto no encontrado");

    expect((await getProduct(a, p.id))?.name).toBe("Solo de A");
  });
});

describe("updateProduct", () => {
  it("updates prices without touching stock", async () => {
    const p = await createProduct(a, { ...base, barcode: "1000000000006", initialStock: "5" });
    const updated = await updateProduct(a, p.id, {
      ...base,
      salePrice: "3000",
      cost: "1300",
      barcode: "1000000000006",
    });
    expect(updated.salePrice.toString()).toBe("3000");
    expect(updated.cost.toString()).toBe("1300");
    expect(updated.stock.toString()).toBe("5");
  });
});

describe("listProducts", () => {
  it("finds products by name (case-insensitive) or exact barcode", async () => {
    await createProduct(a, { ...base, name: "Cargador USB-C", barcode: "1000000000007" });
    expect((await listProducts(a, { q: "cargador" })).some((p) => p.barcode === "1000000000007")).toBe(true);
    expect((await listProducts(a, { q: "1000000000007" })).map((p) => p.name)).toEqual(["Cargador USB-C"]);
  });
});
