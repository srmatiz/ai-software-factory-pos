import { expect, test, type Page } from "@playwright/test";

// Acceptance tests for the Purchases story (docs/features/compras/story.md).
// Requires seeded demo data: npm run db:seed
// Criteria already proven elsewhere (not repeated here):
//   AC7  tests/e2e/purchases.spec.ts "an unknown code shows a message and adds nothing"
//   AC8  tests/e2e/purchases.spec.ts "a CAJERO cannot access /compras"
//   AC9  tests/e2e/purchases.spec.ts "scanning the same product twice raises its quantity"
//   AC11 tests/e2e/purchases.spec.ts "a cost above the sale price warns but still saves"
const ADMIN = { email: "admin@demo.local", password: "demo1234" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Contraseña").fill(ADMIN.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function scan(page: Page, code: string) {
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press("Enter");
}

/**
 * Amount as shown by the client component. The browser formats "2.500,5" where the server
 * (Node) formats "2.500,50", so a trailing zero in the decimals is optional.
 */
function money(amount: string): RegExp {
  return new RegExp(`^${moneyPattern(amount)}$`);
}

function moneyPattern(amount: string): string {
  return `\\$\\s${amount.replace(/\./g, "\\.").replace(/0$/, "0?")}`;
}

function registered(amount: string): RegExp {
  return new RegExp(`Compra registrada\\. Total: ${moneyPattern(amount)}$`);
}

let seq = 0;

/** Creates a product through the UI with a barcode that is unique per run. */
async function createProduct(page: Page, opts: { cost: string; price: string; stock: string }) {
  const barcode = `9${Date.now()}${String(seq++).padStart(2, "0")}`;
  const name = `Aceptacion ${barcode}`;
  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre *").fill(name);
  await page.getByLabel("Código de barras").fill(barcode);
  await page.getByLabel("Costo de adquisición *").fill(opts.cost);
  await page.getByLabel("Precio de venta *").fill(opts.price);
  await page.getByLabel("Stock inicial").fill(opts.stock);
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(/\/productos\?ok=creado/);
  return { barcode, name };
}

/** Reads the cost and stock cells of a product row in /productos. */
async function productRow(page: Page, barcode: string, name: string) {
  await page.goto(`/productos?q=${barcode}`);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toHaveCount(1);
  return { cost: row.getByRole("cell").nth(3), stock: row.getByRole("cell").nth(6) };
}

async function addLine(page: Page, barcode: string, name: string, quantity: string, cost: string) {
  await scan(page, barcode);
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  await page.getByLabel(`Cantidad de ${name}`).fill(quantity);
  await page.getByLabel(`Costo de ${name}`).fill(cost);
}

const save = (page: Page) => page.getByRole("button", { name: "Guardar compra" }).click();

test("AC1: saving a purchase records its total and raises each product's stock", async ({ page }) => {
  await login(page);
  const p1 = await createProduct(page, { cost: "1000", price: "5000", stock: "10" });
  const p2 = await createProduct(page, { cost: "1000", price: "5000", stock: "2" });

  await page.goto("/compras");
  await addLine(page, p1.barcode, p1.name, "5", "1500,5");
  await addLine(page, p2.barcode, p2.name, "3", "1000");
  await expect(page.getByTestId("purchase-total")).toHaveText(money("10.502,50"));
  await save(page);
  await expect(page.getByTestId("purchase-success")).toContainText(registered("10.502,50"));

  expect((await productRow(page, p1.barcode, p1.name)).stock).toHaveText("15");
  expect((await productRow(page, p2.barcode, p2.name)).stock).toHaveText("5");
});

// AC2: the purchase movement (quantity and cost) is not visible in any screen yet.
// Proven in integration: tests/integration/purchases.test.ts "AC2: ...".

test("AC3: with existing stock the cost becomes the weighted average", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "5000", stock: "10" });
  await page.goto("/compras");
  await addLine(page, barcode, name, "10", "2000");
  await save(page);
  await expect(page.getByTestId("purchase-success")).toBeVisible();

  const row = await productRow(page, barcode, name);
  await expect(row.cost).toHaveText("$ 1.500,00");
  await expect(row.stock).toHaveText("20");
});

test("AC4: with no stock the cost becomes the cost entered", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "5000", stock: "0" });
  await page.goto("/compras");
  await addLine(page, barcode, name, "4", "300");
  await save(page);
  await expect(page.getByTestId("purchase-success")).toBeVisible();

  const row = await productRow(page, barcode, name);
  await expect(row.cost).toHaveText("$ 300,00");
  await expect(row.stock).toHaveText("4");
});
// AC4 with negative stock: integration "takes the entered cost when stock is 0 or negative"
// (tests/integration/purchases.test.ts); a negative stock cannot be created from the UI.

test("AC5: when one line is invalid nothing is saved and no stock changes", async ({ page }) => {
  await login(page);
  const good = await createProduct(page, { cost: "1000", price: "5000", stock: "7" });
  const bad = await createProduct(page, { cost: "1000", price: "5000", stock: "9" });

  await page.goto("/compras");
  await addLine(page, good.barcode, good.name, "5", "2000");
  await addLine(page, bad.barcode, bad.name, "", "2000");
  await save(page);
  await expect(page.getByText("La cantidad es obligatoria")).toBeVisible();
  await expect(page.getByTestId("purchase-success")).toHaveCount(0);

  const g = await productRow(page, good.barcode, good.name);
  await expect(g.stock).toHaveText("7");
  await expect(g.cost).toHaveText("$ 1.000,00");
  const b = await productRow(page, bad.barcode, bad.name);
  await expect(b.stock).toHaveText("9");
});
// AC5 with a line that passes validation but fails in the database (invalid product):
// integration "rolls everything back when one line has an invalid product".

test("AC6: empty, zero or negative quantity and cost show a Spanish error and save nothing", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "5000", stock: "6" });
  await page.goto("/compras");
  await scan(page, barcode);
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  const qty = page.getByLabel(`Cantidad de ${name}`);
  const cost = page.getByLabel(`Costo de ${name}`);

  // Empty cost (the line starts with quantity 1 and no cost).
  await save(page);
  await expect(page.getByText("El costo es obligatorio")).toBeVisible();

  await cost.fill("0");
  await save(page);
  await expect(page.getByText("El costo debe ser mayor que 0")).toBeVisible();

  await cost.fill("-5");
  await save(page);
  await expect(page.getByText("El costo debe ser mayor que 0")).toBeVisible();

  await cost.fill("1000");
  await qty.fill("");
  await save(page);
  await expect(page.getByText("La cantidad es obligatoria")).toBeVisible();

  await qty.fill("0");
  await save(page);
  await expect(page.getByText("La cantidad debe ser mayor que 0")).toBeVisible();

  await qty.fill("-2");
  await save(page);
  await expect(page.getByText("La cantidad debe ser mayor que 0")).toBeVisible();

  await expect(page.getByTestId("purchase-success")).toHaveCount(0);
  await expect((await productRow(page, barcode, name)).stock).toHaveText("6");
});

test("AC6: a decimal comma is accepted in costs", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "5000", stock: "0" });
  await page.goto("/compras");
  await addLine(page, barcode, name, "2", "1250,75");
  await save(page);
  await expect(page.getByTestId("purchase-success")).toContainText(registered("2.501,50"));
  await expect((await productRow(page, barcode, name)).cost).toHaveText("$ 1.250,75");
});

test("AC10: with the batch total the unit cost is total divided by quantity", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "5000", stock: "0" });
  await page.goto("/compras");
  await scan(page, barcode);
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  await page.getByLabel(`Cantidad de ${name}`).fill("4");
  await page.getByLabel(`Tipo de costo: ${name}`).selectOption("total");
  await page.getByLabel(`Costo de ${name}`).fill("2500,50");
  await expect(page.getByTestId("purchase-total")).toHaveText(money("2.500,50"));
  await save(page);
  await expect(page.getByTestId("purchase-success")).toContainText(registered("2.500,50"));

  // 2500.50 / 4 = 625.125 per unit (cost shown with 2 decimals).
  const row = await productRow(page, barcode, name);
  await expect(row.cost).toHaveText("$ 625,13");
  await expect(row.stock).toHaveText("4");
});

// AC12: there is no screen to deactivate a product nor one that shows the active flag.
// Proven in integration: tests/integration/purchases.test.ts "accepts an inactive product and reactivates it".

test("AC13: a quantity with decimals shows a Spanish error", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "5000", stock: "3" });
  await page.goto("/compras");
  await addLine(page, barcode, name, "2.5", "1000");
  await save(page);
  await expect(page.getByText("La cantidad debe ser un número entero")).toBeVisible();

  await page.getByLabel(`Cantidad de ${name}`).fill("1,5");
  await save(page);
  await expect(page.getByText("La cantidad debe ser un número entero")).toBeVisible();

  await expect(page.getByTestId("purchase-success")).toHaveCount(0);
  await expect((await productRow(page, barcode, name)).stock).toHaveText("3");
});

test("Edge: a purchase with no products cannot be saved", async ({ page }) => {
  await login(page);
  await page.goto("/compras");
  await expect(page.getByRole("button", { name: "Guardar compra" })).toBeDisabled();
  await expect(page.getByTestId("purchase-total")).toHaveText(/^\$\s0(,00)?$/);
});

test("Edge: the total is the sum of the line subtotals and is rounded only at the end", async ({ page }) => {
  await login(page);
  const a = await createProduct(page, { cost: "1", price: "5000", stock: "0" });
  const b = await createProduct(page, { cost: "1", price: "5000", stock: "0" });
  await page.goto("/compras");
  await addLine(page, a.barcode, a.name, "1", "0,0049");
  await addLine(page, b.barcode, b.name, "1", "0,0049");
  // Each subtotal alone rounds to 0,00 but together they are 0,0098 -> 0,01.
  await expect(page.getByTestId("purchase-total")).toHaveText("$ 0,01");
  await save(page);
  await expect(page.getByTestId("purchase-success")).toContainText("Compra registrada. Total: $ 0,01");
});

test("Edge: a quantity above the maximum shows a Spanish error", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "5000", stock: "1" });
  await page.goto("/compras");
  await addLine(page, barcode, name, "1000000000", "1000");
  await save(page);
  await expect(page.getByText("La cantidad es demasiado alta")).toBeVisible();
  await expect((await productRow(page, barcode, name)).stock).toHaveText("1");
});

test("Edge: a unit cost above the maximum shows a Spanish error", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "5000", stock: "1" });
  await page.goto("/compras");
  await addLine(page, barcode, name, "1", "100000000");
  await save(page);
  await expect(page.getByText("El costo es demasiado alto")).toBeVisible();
  await expect((await productRow(page, barcode, name)).stock).toHaveText("1");
});
