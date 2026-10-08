import { expect, test, type Page } from "@playwright/test";

// Requires seeded demo data: npm run db:seed
const ADMIN = { email: "admin@demo.local", password: "demo1234" };
const CAJERO = { email: "cajero@demo.local", password: "demo1234" };

async function login(page: Page, user = ADMIN) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Simulates a USB barcode scanner: very fast keystrokes followed by Enter. */
async function scan(page: Page, code: string) {
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press("Enter");
}

/** Creates a product through the UI so each run has its own barcode and known stock. */
async function createProduct(page: Page, opts: { cost: string; price: string; stock: string }) {
  const barcode = `98${Date.now()}`.slice(0, 13) + Math.floor(Math.random() * 10);
  const name = `Compra E2E ${barcode}`;
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

test("scan, enter quantity and cost, save, and see the updated stock", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "2500", stock: "10" });

  await page.goto("/compras");
  await expect(page.getByRole("button", { name: "Guardar compra" })).toBeDisabled();
  await scan(page, barcode);
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  await page.getByLabel(`Cantidad de ${name}`).fill("5");
  await page.getByLabel(`Costo de ${name}`).fill("1500,5");
  await page.getByRole("button", { name: "Guardar compra" }).click();

  await expect(page.getByTestId("purchase-success")).toContainText("Compra registrada");
  await expect(page.getByRole("cell", { name, exact: true })).toHaveCount(0);

  await page.goto(`/productos?q=${barcode}`);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("15");
});

test("scanning the same product twice raises its quantity", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "2500", stock: "1" });

  await page.goto("/compras");
  await scan(page, barcode);
  await expect(page.getByLabel(`Cantidad de ${name}`)).toHaveValue("1");
  await scan(page, barcode);
  await expect(page.getByLabel(`Cantidad de ${name}`)).toHaveValue("2");
  await expect(page.getByRole("cell", { name, exact: true })).toHaveCount(1);
});

test("an unknown code shows a message and adds nothing", async ({ page }) => {
  await login(page);
  await page.goto("/compras");
  await scan(page, `0000${Date.now()}`);
  await expect(page.getByText("Código no encontrado")).toBeVisible();
  await expect(page.getByText("Aún no hay productos en la compra.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar compra" })).toBeDisabled();
});

test("a cost above the sale price warns but still saves", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "2000", stock: "0" });

  await page.goto("/compras");
  await scan(page, barcode);
  await page.getByLabel(`Costo de ${name}`).fill("3000");
  await expect(page.getByText(/es mayor que el precio de venta/)).toBeVisible();
  await page.getByRole("button", { name: "Guardar compra" }).click();
  await expect(page.getByTestId("purchase-success")).toContainText("Compra registrada");
});

test("an empty quantity shows a Spanish error", async ({ page }) => {
  await login(page);
  const { barcode, name } = await createProduct(page, { cost: "1000", price: "2000", stock: "0" });

  await page.goto("/compras");
  await scan(page, barcode);
  await page.getByLabel(`Cantidad de ${name}`).fill("");
  await page.getByLabel(`Costo de ${name}`).fill("1000");
  await page.getByRole("button", { name: "Guardar compra" }).click();
  await expect(page.getByText("La cantidad es obligatoria")).toBeVisible();
});

test("a CAJERO cannot access /compras", async ({ page }) => {
  await login(page, CAJERO);
  await expect(page.getByRole("link", { name: "Compras" })).toHaveCount(0);
  await page.goto("/compras");
  await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);
});
