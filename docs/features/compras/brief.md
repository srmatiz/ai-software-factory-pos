# Approved technical brief: Purchases (stock receiving)

Status: approved by the human on 2026-10-07. Story: `docs/features/compras/story.md` (criteria 1–13).

## Data model changes

- None. `Purchase`, `PurchaseItem`, `InventoryMovement` and `MovementType.COMPRA` already exist in `prisma/schema.prisma`; no migration.
- `Purchase.supplierId = null` and `invoiceRef = null` (no supplier in this story). `userId` = `ctx.userId`.
- Column types are already right: quantity `Decimal(12,3)`, `unitCost` `Decimal(12,4)`, `total` `Decimal(12,2)`.
- No new scheduler, database, storage or dependency.

## Process flow

1. `/compras/page.tsx` (server, `requireRole("ADMIN")`) renders `purchase-form.tsx` (client). Scanning uses `useBarcodeScanner`.
2. When a scan finishes, the client calls `lookupProductByBarcodeAction(barcode)` (**new**). It authorizes with `requireRole("ADMIN")` and calls `findProductByBarcode(ctx, barcode)`. It returns `{ id, name, barcode, salePrice, cost, stock, active }` with Decimals serialized to `string`, or `null` (the client shows "Código no encontrado" and adds nothing). Inactive products are returned like any other (criterion 12).
3. The client keeps the lines in state. If the `productId` is already in the purchase, it adds 1 to that line's quantity instead of adding a line (criterion 9). Each line has a cost mode: "unit cost" or "batch total". The client computes line subtotals, the total and the cost > sale price warning with `src/lib/purchase.ts` (**new**, built on `money.ts`).
4. On save, `createPurchaseAction(lines)` (**new**) calls `requireRole("ADMIN")`, then `createPurchase(ctx, raw)`, which validates with `createPurchaseSchema.parse` (Zod, Spanish messages, decimal comma in costs). A purchase with no lines is an error ("Agrega al menos un producto").
5. The service opens `db.$transaction` and locks the products with `SELECT id, stock, cost FROM "Product" WHERE "businessId" = $1 AND id = ANY($2) ORDER BY id FOR UPDATE` via `tx.$queryRaw`. Ordering by `id` avoids deadlocks. If rows are missing (foreign or unknown id) it throws `DomainError("Producto no válido")` and everything rolls back.
6. For each line, with the locked values: compute `unitCost` (batch-total mode: total ÷ quantity, rounded to 4 decimals) and `newCost = weightedAverageCost(stock, cost, qty, unitCost)`. Then `tx.product.update({ stock: { increment: qty }, cost: newCost, active: true })` and `tx.inventoryMovement.create({ type: "COMPRA", quantity: +qty, unitCost, reference: purchase.id, userId, businessId })`. Setting `active: true` reactivates inactive products (criterion 12).
7. Create the `Purchase` with its nested `PurchaseItem` rows and `total`. Rounding happens only at the end: line subtotals are not rounded (in batch-total mode the line subtotal is the batch total entered; in unit-cost mode it is quantity × unit cost), and `total` = sum of line subtotals rounded to 2 decimals. Everything is in the same transaction, so a failure in any line leaves nothing saved (criterion 5).
8. The action calls `revalidatePath("/compras")` and `revalidatePath("/productos")`. `ZodError` and `DomainError` are translated to form state like `toFormState` in Productos, with errors keyed by their full path (`lines.0.quantity`) so the UI can show them per line. Unexpected errors are rethrown. The UI shows success and clears the purchase.

## API changes

- `createPurchaseAction(lines)` in `src/app/(app)/compras/actions.ts` (**new**). Role `ADMIN`. Input: `createPurchaseSchema` = `{ lines: [{ productId, quantity, costMode: "unit" | "total", cost }] }`, all strings.
  - `quantity`: required, whole number > 0 (empty, 0, negative and decimals are errors in Spanish; criteria 6 and 13). Maximum: what `Decimal(12,3)` allows.
  - `cost`: required, > 0, decimal comma accepted; unit cost up to the `Decimal(12,4)` maximum, batch total up to the `Decimal(12,2)` maximum.
  - Errors: `ZodError` per field and line; `DomainError("Producto no válido")` if a product is not from the business; `DomainError` if the payload repeats a `productId` (merging duplicates is a UI concern).
  - Returns the purchase id and total, or the error state.
- `lookupProductByBarcodeAction(barcode)` in the same file (**new**). Role `ADMIN`. Read-only, scoped by `ctx.businessId`. Returns the serialized product (including inactive ones) or `null`.
- Service `createPurchase(ctx, raw, db = defaultDb)` in `src/server/services/purchases.ts` (**new**). Reuses `findProductByBarcode` from `products.ts`.

## Frontend changes

- `src/app/(app)/compras/page.tsx` (modified): removes the "Próximamente" placeholder, requires `ADMIN` and renders the form.
- `src/app/(app)/compras/purchase-form.tsx` (client, **new**), with shadcn/ui and `useBarcodeScanner`:
  - Line table: name, quantity (whole numbers), cost mode selector (unit cost / batch total), cost, subtotal and remove button.
  - Purchase total computed with `src/lib/purchase.ts` (Decimal, never `number`).
  - A visible warning on the line when its unit cost is higher than `salePrice`; it does not block saving (criterion 11).
  - Message when an unknown code is scanned, and Spanish errors per line.
  - The Save button is disabled while the purchase has no lines; the server also rejects an empty purchase.

## Tests required

- Unit (`tests/unit/purchase-schema.test.ts`, `tests/unit/purchase.test.ts`):
  - Schema: valid line; empty, 0 and negative quantity/cost with Spanish messages; decimal quantity rejected (criterion 13); decimal comma in cost ("1,5"); very small and very large values; empty line list.
  - `src/lib/purchase.ts`: unit cost = total ÷ quantity (criterion 10); subtotals and total, rounded only at the end (edge case); cost > sale price warning, and no warning when equal or lower (criterion 11).
- Component (`tests/component/purchase-form.test.tsx`, server actions mocked):
  - Scanning a known code adds a line; scanning it again raises the quantity to 2 (criterion 9).
  - Unknown code shows the message and adds nothing (criterion 7).
  - Cost above the sale price shows the warning and Save stays enabled (criterion 11).
  - Save is disabled with no lines; per-line errors from the action are shown next to their line.
- Integration (`tests/integration/purchases.test.ts`, with `createTenant`/`deleteTenant`):
  - Success with several products: `Purchase.total`, `PurchaseItem` rows, `Product.stock` up, and one `COMPRA` movement per line with positive quantity, `unitCost` and `reference` = purchase id (criteria 1 and 2).
  - Cost: weighted average with stock > 0 (criterion 3); with stock 0 or negative the cost becomes the entered cost (criterion 4); batch-total mode uses total ÷ quantity (criterion 10).
  - An inactive product is accepted and becomes active (criterion 12).
  - Atomicity: a line with an invalid product rolls everything back, no stock or movement changes (criterion 5).
  - Isolation: business B cannot buy business A's product and A's stock does not change; lookup of A's barcode from B returns nothing (criteria 7 and 8). Two concurrent `createPurchase` calls on the same product end with consistent stock and cost.
- E2E (`tests/e2e/purchases.spec.ts`, with the seed, codes with `Date.now()`):
  - Scan with `keyboard.type(code, { delay: 5 })`, enter quantity and cost, save, and see the updated stock in `/productos`.
  - Double scan raises the quantity (9); unknown code shows the message (7); cost > price warning and the purchase still saves (11); Spanish error for an empty quantity (6).
  - A CAJERO cannot access `/compras` (8).

## Risks and open questions

- Tenant isolation: `businessId` comes only from `requireRole("ADMIN")`. Product ids from the client are checked in the `SELECT ... FOR UPDATE` with `"businessId" = ctx.businessId` and all of them must come back. Barcodes resolve through `findProductByBarcode(ctx, ...)`. `businessId` is never accepted as input.
- Timezone: there is no date handling in `src/` (search for `new Date`, `toLocale`, `timeZone` found nothing). This story shows no dates. `Purchase.createdAt` and `InventoryMovement.createdAt` use `@default(now())` (UTC).
- Concurrency: the average cost is read and rewritten, so an atomic increment is not enough. The mechanism is the `SELECT ... FOR UPDATE` row lock ordered by `id` inside the transaction; `Product.cost` is written only from values computed on the locked rows.
- `tx.$queryRaw` returns raw values: convert them to `Prisma.Decimal` and use the real table and column names (no `@@map` on `Product` today).
- Overflow: `stock + qty` can exceed `Decimal(12,3)` and the cost `Decimal(12,4)`; map that Prisma error to a Spanish `DomainError`.
- Open questions: none. Resolved by the human: rounding only of the final total; inactive products allowed and reactivated; whole-unit quantities until the unit-of-measure story; negative stock counts as no stock.

## Files that will change

- `src/lib/schemas/purchase.ts` — new — Zod schema for the purchase and its lines (Spanish messages, decimal comma in costs, whole quantities)
- `src/lib/purchase.ts` — new — shared pure calculations: unit cost, subtotals, total and cost > price warning
- `src/server/services/purchases.ts` — new — `createPurchase` with transaction, `FOR UPDATE`, weighted average, reactivation and movements
- `src/app/(app)/compras/actions.ts` — new — `createPurchaseAction` and `lookupProductByBarcodeAction`, both `ADMIN`
- `src/app/(app)/compras/page.tsx` — modified — replaces the placeholder with the purchase form
- `src/app/(app)/compras/purchase-form.tsx` — new — client form with scanner, lines and total
- `tests/unit/purchase-schema.test.ts` — new — schema tests
- `tests/unit/purchase.test.ts` — new — pure calculation tests
- `tests/component/purchase-form.test.tsx` — new — form behaviour with mocked actions
- `tests/integration/purchases.test.ts` — new — service: stock, movements, cost, reactivation, atomicity, isolation and concurrency
- `tests/integration/helpers.ts` — modified — `deleteTenant()` also deletes `Purchase` (and its items)
- `tests/e2e/purchases.spec.ts` — new — flow with simulated scanner
- `docs/roadmap.md` — modified — mark Purchases as done at the end
- `README.md` — modified — update the module status table at the end
