import { Prisma, type PrismaClient } from "@prisma/client";
import { db as defaultDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import type { TenantContext } from "@/server/tenant";
import {
  createProductSchema,
  productInputSchema,
  type CreateProductInput,
  type ProductInput,
} from "@/lib/schemas/product";

// Service layer: pure business logic. Every function takes a TenantContext
// and scopes all queries by ctx.businessId. `db` is injectable for tests.

type Db = PrismaClient;

export type ProductListFilters = { q?: string; categoryId?: string };

export async function listProducts(ctx: TenantContext, filters: ProductListFilters = {}, db: Db = defaultDb) {
  const q = filters.q?.trim();
  return db.product.findMany({
    where: {
      businessId: ctx.businessId,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { barcode: q },
              { sku: { equals: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });
}

export async function getProduct(ctx: TenantContext, id: string, db: Db = defaultDb) {
  return db.product.findFirst({ where: { id, businessId: ctx.businessId } });
}

export async function findProductByBarcode(ctx: TenantContext, barcode: string, db: Db = defaultDb) {
  return db.product.findUnique({
    where: { businessId_barcode: { businessId: ctx.businessId, barcode } },
  });
}

export async function createProduct(ctx: TenantContext, raw: CreateProductInput | unknown, db: Db = defaultDb) {
  const input = createProductSchema.parse(raw);
  await assertCategoryBelongsToBusiness(ctx, input.categoryId, db);

  const cost = new Prisma.Decimal(input.cost);
  const initialStock = new Prisma.Decimal(input.initialStock);

  try {
    return await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          businessId: ctx.businessId,
          ...productData(input),
          stock: initialStock,
        },
      });

      // Opening stock enters the kardex at the declared acquisition cost.
      if (initialStock.gt(0)) {
        await tx.inventoryMovement.create({
          data: {
            businessId: ctx.businessId,
            productId: product.id,
            userId: ctx.userId,
            type: "INICIAL",
            quantity: initialStock,
            unitCost: cost,
            note: "Stock inicial al crear el producto",
          },
        });
      }
      return product;
    });
  } catch (e) {
    throw mapUniqueViolation(e);
  }
}

/** Updates descriptive fields and prices. Stock changes go through inventory movements, never here. */
export async function updateProduct(ctx: TenantContext, id: string, raw: ProductInput | unknown, db: Db = defaultDb) {
  const input = productInputSchema.parse(raw);
  const existing = await getProduct(ctx, id, db);
  if (!existing) throw new DomainError("Producto no encontrado");
  await assertCategoryBelongsToBusiness(ctx, input.categoryId, db);

  try {
    return await db.product.update({ where: { id: existing.id }, data: productData(input) });
  } catch (e) {
    throw mapUniqueViolation(e);
  }
}

export async function listCategories(ctx: TenantContext, db: Db = defaultDb) {
  return db.category.findMany({ where: { businessId: ctx.businessId }, orderBy: { name: "asc" } });
}

function productData(input: ProductInput) {
  return {
    name: input.name,
    barcode: input.barcode ?? null,
    sku: input.sku ?? null,
    categoryId: input.categoryId ?? null,
    salePrice: new Prisma.Decimal(input.salePrice),
    cost: new Prisma.Decimal(input.cost),
    taxRate: new Prisma.Decimal(input.taxRate),
    minStock: new Prisma.Decimal(input.minStock),
  };
}

async function assertCategoryBelongsToBusiness(ctx: TenantContext, categoryId: string | undefined, db: Db) {
  if (!categoryId) return;
  const found = await db.category.findFirst({ where: { id: categoryId, businessId: ctx.businessId } });
  if (!found) throw new DomainError("Categoría no válida", "categoryId");
}

function mapUniqueViolation(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = String(e.meta?.target ?? "");
    if (target.includes("barcode")) return new DomainError("Ya existe un producto con ese código de barras", "barcode");
    if (target.includes("sku")) return new DomainError("Ya existe un producto con ese SKU", "sku");
  }
  return e;
}
