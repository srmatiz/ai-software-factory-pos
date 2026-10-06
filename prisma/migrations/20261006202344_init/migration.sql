-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CAJERO');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('INICIAL', 'COMPRA', 'VENTA', 'AJUSTE', 'DEVOLUCION');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ticketHeader" TEXT,
    "ticketFooter" TEXT,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CAJERO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT,
    "barcode" TEXT,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "cost" DECIMAL(12,4) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "MovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT,
    "userId" TEXT NOT NULL,
    "invoiceRef" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Register" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'ABIERTA',
    "openingAmount" DECIMAL(12,2) NOT NULL,
    "expectedAmount" DECIMAL(12,2),
    "countedAmount" DECIMAL(12,2),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "userId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETADA',
    "createdOfflineAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "received" DECIMAL(12,2),
    "change" DECIMAL(12,2),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_businessId_idx" ON "User"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_businessId_name_key" ON "Category"("businessId", "name");

-- CreateIndex
CREATE INDEX "Product_businessId_name_idx" ON "Product"("businessId", "name");

-- CreateIndex
CREATE INDEX "Product_businessId_updatedAt_idx" ON "Product"("businessId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_barcode_key" ON "Product"("businessId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_sku_key" ON "Product"("businessId", "sku");

-- CreateIndex
CREATE INDEX "InventoryMovement_businessId_productId_createdAt_idx" ON "InventoryMovement"("businessId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "Supplier_businessId_idx" ON "Supplier"("businessId");

-- CreateIndex
CREATE INDEX "Purchase_businessId_createdAt_idx" ON "Purchase"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Register_businessId_prefix_key" ON "Register"("businessId", "prefix");

-- CreateIndex
CREATE INDEX "CashSession_businessId_registerId_status_idx" ON "CashSession"("businessId", "registerId", "status");

-- CreateIndex
CREATE INDEX "Sale_businessId_createdAt_idx" ON "Sale"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_businessId_ticketNumber_key" ON "Sale"("businessId", "ticketNumber");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Register" ADD CONSTRAINT "Register_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
