import { expect, test, type Page } from "@playwright/test";

// Requires seeded demo data: npm run db:seed
const ADMIN = { email: "admin@demo.local", password: "demo1234" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Contraseña").fill(ADMIN.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Simulates a USB barcode scanner: very fast keystrokes followed by Enter. */
async function scan(page: Page, code: string) {
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press("Enter");
}

test("redirects to login when not authenticated", async ({ page }) => {
  await page.goto("/productos");
  await expect(page).toHaveURL(/\/login/);
});

test("rejects wrong credentials", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Contraseña").fill("wrong-password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Email o contraseña incorrectos")).toBeVisible();
});

test("admin creates a product by scanning its barcode; duplicates are rejected", async ({ page }) => {
  const barcode = `99${Date.now()}`.slice(0, 13);
  const name = `Producto E2E ${barcode}`;

  await login(page);
  await page.goto("/productos/nuevo");

  // Cursor sits in "Nombre" when the scanner fires: the code must land in the
  // barcode field and be removed from the name.
  await page.getByLabel("Nombre *").fill(name);
  await scan(page, barcode);
  await expect(page.getByLabel("Código de barras")).toHaveValue(barcode);
  await expect(page.getByLabel("Nombre *")).toHaveValue(name);
  await expect(page).toHaveURL(/\/productos\/nuevo/); // Enter from the scanner did not submit

  await page.getByLabel("Costo de adquisición *").fill("1200");
  await page.getByLabel("Precio de venta *").fill("2500");
  await expect(page.getByTestId("margin-preview")).toContainText("52,0");
  await page.getByLabel("Stock inicial").fill("10");
  await page.getByRole("button", { name: "Crear producto" }).click();

  await expect(page).toHaveURL(/\/productos\?ok=creado/);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText(barcode);
  await expect(row).toContainText("52,0");
  await expect(row).toContainText("10");

  // Same barcode again is rejected with a field error.
  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre *").fill(`${name} duplicado`);
  await page.getByLabel("Código de barras").fill(barcode);
  await page.getByLabel("Costo de adquisición *").fill("1");
  await page.getByLabel("Precio de venta *").fill("2");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page.getByText("Ya existe un producto con ese código de barras")).toBeVisible();
});

test("sale price and cost are required", async ({ page }) => {
  await login(page);
  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre *").fill("Sin precios");
  // Bypass native `required` to exercise server-side validation.
  await page.locator("form", { hasText: "Crear producto" }).evaluate((f) => f.setAttribute("novalidate", ""));
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page.getByText("El precio de venta es obligatorio")).toBeVisible();
  await expect(page.getByText("El costo es obligatorio")).toBeVisible();
});
