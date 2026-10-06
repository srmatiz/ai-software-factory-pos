// Demo data for local development and e2e tests. Fictitious only.
// Refuses to run in production: real admins are created with `npm run create-admin`.
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

export const DEMO_BUSINESS_ID = "demo-business";
export const DEMO_PASSWORD = "demo1234";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed is for development only. Use `npm run create-admin` in production.");
  }

  const business = await db.business.upsert({
    where: { id: DEMO_BUSINESS_ID },
    update: {},
    create: {
      id: DEMO_BUSINESS_ID,
      name: "Tienda Demo",
      currency: "COP",
      defaultTaxRate: new Prisma.Decimal(19),
      ticketHeader: "Tienda Demo - Local 101",
      ticketFooter: "¡Gracias por su compra!",
    },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of [
    { email: "admin@demo.local", name: "Admin Demo", role: "ADMIN" as const },
    { email: "cajero@demo.local", name: "Cajero Demo", role: "CAJERO" as const },
  ]) {
    await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, businessId: business.id },
    });
  }

  await db.register.upsert({
    where: { businessId_prefix: { businessId: business.id, prefix: "C1" } },
    update: {},
    create: { businessId: business.id, name: "Caja 1", prefix: "C1" },
  });

  const categories: Record<string, string> = {};
  for (const name of ["Bebidas", "Snacks", "Accesorios"]) {
    const c = await db.category.upsert({
      where: { businessId_name: { businessId: business.id, name } },
      update: {},
      create: { businessId: business.id, name },
    });
    categories[name] = c.id;
  }

  const products = [
    { barcode: "7702004003508", name: "Agua 600ml", category: "Bebidas", salePrice: 2500, cost: 1200, stock: 48 },
    { barcode: "7702354950309", name: "Gaseosa 400ml", category: "Bebidas", salePrice: 3500, cost: 1900, stock: 36 },
    { barcode: "7702189012345", name: "Papas fritas 45g", category: "Snacks", salePrice: 3000, cost: 1700, stock: 24 },
    {
      barcode: "7709990000011",
      name: "Cargador USB-C",
      category: "Accesorios",
      salePrice: 25000,
      cost: 11000,
      stock: 5,
    },
  ];

  for (const p of products) {
    const exists = await db.product.findUnique({
      where: { businessId_barcode: { businessId: business.id, barcode: p.barcode } },
    });
    if (exists) continue;
    const product = await db.product.create({
      data: {
        businessId: business.id,
        categoryId: categories[p.category],
        barcode: p.barcode,
        name: p.name,
        salePrice: new Prisma.Decimal(p.salePrice),
        cost: new Prisma.Decimal(p.cost),
        taxRate: new Prisma.Decimal(19),
        stock: new Prisma.Decimal(p.stock),
        minStock: new Prisma.Decimal(5),
      },
    });
    await db.inventoryMovement.create({
      data: {
        businessId: business.id,
        productId: product.id,
        type: "INICIAL",
        quantity: new Prisma.Decimal(p.stock),
        unitCost: new Prisma.Decimal(p.cost),
        note: "Seed",
      },
    });
  }

  console.log(`Seed listo. Usuarios: admin@demo.local / cajero@demo.local (contraseña: ${DEMO_PASSWORD})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
