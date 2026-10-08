import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LookedUpProduct, PurchaseActionState } from "@/app/(app)/compras/actions";
import { PurchaseForm } from "@/app/(app)/compras/purchase-form";

const { lookup, create } = vi.hoisted(() => ({
  lookup: vi.fn<(code: string) => Promise<LookedUpProduct | null>>(),
  create: vi.fn<(lines: unknown) => Promise<PurchaseActionState>>(),
}));
vi.mock("@/app/(app)/compras/actions", () => ({
  lookupProductByBarcodeAction: lookup,
  createPurchaseAction: create,
}));

const agua: LookedUpProduct = {
  id: "p1",
  name: "Agua 600ml",
  barcode: "7702004003508",
  salePrice: "2500",
  cost: "1200",
  stock: "48",
  active: true,
};

let t = 1000;
/** Simulates a scanner burst: fast keystrokes followed by Enter. */
async function scan(code: string) {
  t += 1000;
  await act(async () => {
    for (const ch of code) {
      fireEvent.keyDown(document.body, { key: ch });
      t += 5;
    }
    fireEvent.keyDown(document.body, { key: "Enter" });
  });
}

// jsdom assigns keydown timestamps from real time; drive them deterministically.
beforeEach(() => {
  lookup.mockReset();
  create.mockReset();
  vi.spyOn(Event.prototype, "timeStamp", "get").mockImplementation(() => t);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PurchaseForm", () => {
  it("disables Save while there are no lines", () => {
    render(<PurchaseForm currency="COP" />);
    expect((screen.getByRole("button", { name: "Guardar compra" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("adds a line when a known code is scanned and raises quantity on a second scan", async () => {
    lookup.mockResolvedValue(agua);
    render(<PurchaseForm currency="COP" />);
    await scan(agua.barcode!);
    expect(await screen.findByText("Agua 600ml")).toBeTruthy();
    expect((screen.getByLabelText("Cantidad de Agua 600ml") as HTMLInputElement).value).toBe("1");
    expect((screen.getByRole("button", { name: "Guardar compra" }) as HTMLButtonElement).disabled).toBe(false);

    await scan(agua.barcode!);
    await waitFor(() => expect((screen.getByLabelText("Cantidad de Agua 600ml") as HTMLInputElement).value).toBe("2"));
    expect(screen.getAllByText("Agua 600ml")).toHaveLength(1);
  });

  it("shows a message and adds nothing for an unknown code", async () => {
    lookup.mockResolvedValue(null);
    render(<PurchaseForm currency="COP" />);
    await scan("0000000000000");
    expect(await screen.findByText("Código no encontrado")).toBeTruthy();
    expect(screen.getByText("Aún no hay productos en la compra.")).toBeTruthy();
  });

  it("warns when unit cost is above the sale price and keeps Save enabled", async () => {
    lookup.mockResolvedValue(agua);
    render(<PurchaseForm currency="COP" />);
    await scan(agua.barcode!);
    await screen.findByText("Agua 600ml");
    fireEvent.change(screen.getByLabelText("Costo de Agua 600ml"), { target: { value: "3000" } });
    expect(screen.getByText(/es mayor que el precio de venta/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Guardar compra" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getByLabelText("Costo de Agua 600ml"), { target: { value: "2500" } });
    expect(screen.queryByText(/es mayor que el precio de venta/)).toBeNull();
  });

  it("computes the unit cost from a batch total for the warning", async () => {
    lookup.mockResolvedValue(agua);
    render(<PurchaseForm currency="COP" />);
    await scan(agua.barcode!);
    await screen.findByText("Agua 600ml");
    fireEvent.change(screen.getByLabelText("Cantidad de Agua 600ml"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Tipo de costo: Agua 600ml"), { target: { value: "total" } });
    fireEvent.change(screen.getByLabelText("Costo de Agua 600ml"), { target: { value: "20000" } });
    expect(screen.queryByText(/es mayor que el precio de venta/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Costo de Agua 600ml"), { target: { value: "30000" } });
    expect(screen.getByText(/es mayor que el precio de venta/)).toBeTruthy();
  });

  it("shows per-line errors from the action next to their line", async () => {
    lookup.mockResolvedValue(agua);
    create.mockResolvedValue({
      ok: false,
      errors: { "lines.0.quantity": "La cantidad es obligatoria", "lines.0.cost": "El costo es obligatorio" },
    });
    render(<PurchaseForm currency="COP" />);
    await scan(agua.barcode!);
    await screen.findByText("Agua 600ml");
    fireEvent.change(screen.getByLabelText("Cantidad de Agua 600ml"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }));

    const qty = screen.getByLabelText("Cantidad de Agua 600ml");
    expect(await screen.findByText("La cantidad es obligatoria")).toBeTruthy();
    expect(qty.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("El costo es obligatorio")).toBeTruthy();
  });

  it("shows a form-level message from the action", async () => {
    lookup.mockResolvedValue(agua);
    create.mockResolvedValue({ ok: false, message: "Producto no válido" });
    render(<PurchaseForm currency="COP" />);
    await scan(agua.barcode!);
    await screen.findByText("Agua 600ml");
    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }));
    expect(await screen.findByText("Producto no válido")).toBeTruthy();
  });

  it("sends the lines, shows success and clears the purchase", async () => {
    lookup.mockResolvedValue(agua);
    create.mockResolvedValue({ ok: true, id: "c1", total: "5000" });
    render(<PurchaseForm currency="COP" />);
    await scan(agua.barcode!);
    await screen.findByText("Agua 600ml");
    fireEvent.change(screen.getByLabelText("Cantidad de Agua 600ml"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Costo de Agua 600ml"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }));

    expect(await screen.findByText(/Compra registrada/)).toBeTruthy();
    expect(create).toHaveBeenCalledWith([{ productId: "p1", quantity: "5", costMode: "unit", cost: "1000" }]);
    expect(screen.queryByText("Agua 600ml")).toBeNull();
    expect((screen.getByRole("button", { name: "Guardar compra" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
