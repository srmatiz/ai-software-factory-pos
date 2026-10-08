import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { DomainError } from "@/server/errors";

const requireRole = vi.fn();
const createPurchase = vi.fn();
const findProductByBarcode = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/server/tenant", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/server/services/purchases", () => ({ createPurchase: (...a: unknown[]) => createPurchase(...a) }));
vi.mock("@/server/services/products", () => ({
  findProductByBarcode: (...a: unknown[]) => findProductByBarcode(...a),
}));

import { createPurchaseAction, lookupProductByBarcodeAction } from "@/app/(app)/compras/actions";

const ctx = { businessId: "b1", userId: "u1", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(ctx);
});

describe("role enforcement", () => {
  it("requires ADMIN and stops a CAJERO before touching the service", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(createPurchaseAction([])).rejects.toThrow("NEXT_REDIRECT");
    await expect(lookupProductByBarcodeAction("123")).rejects.toThrow("NEXT_REDIRECT");
    expect(requireRole).toHaveBeenCalledTimes(2);
    expect(requireRole).toHaveBeenNthCalledWith(1, "ADMIN");
    expect(requireRole).toHaveBeenNthCalledWith(2, "ADMIN");
    expect(createPurchase).not.toHaveBeenCalled();
    expect(findProductByBarcode).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createPurchaseAction error mapping", () => {
  it("rethrows unexpected errors", async () => {
    createPurchase.mockRejectedValue(new Error("db down"));
    await expect(createPurchaseAction([])).rejects.toThrow("db down");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("maps ZodError to errors keyed by full path", async () => {
    const err = new ZodError([
      { code: "custom", path: ["lines", 0, "quantity"], message: "La cantidad es obligatoria" },
      { code: "custom", path: ["lines", 0, "quantity"], message: "segundo" },
      { code: "custom", path: [], message: "Formulario inválido" },
    ]);
    createPurchase.mockRejectedValue(err);
    await expect(createPurchaseAction([])).resolves.toEqual({
      ok: false,
      errors: { "lines.0.quantity": "La cantidad es obligatoria", form: "Formulario inválido" },
    });
  });

  it("maps DomainError with and without field", async () => {
    createPurchase.mockRejectedValueOnce(new DomainError("Producto inválido", "lines.0.productId"));
    await expect(createPurchaseAction([])).resolves.toEqual({
      ok: false,
      errors: { "lines.0.productId": "Producto inválido" },
    });
    createPurchase.mockRejectedValueOnce(new DomainError("Algo falló"));
    await expect(createPurchaseAction([])).resolves.toEqual({ ok: false, message: "Algo falló" });
  });

  it("returns ok and revalidates on success", async () => {
    createPurchase.mockResolvedValue({ id: "p1", total: { toString: () => "100" } });
    await expect(createPurchaseAction([{}])).resolves.toEqual({ ok: true, id: "p1", total: "100" });
    expect(createPurchase).toHaveBeenCalledWith(ctx, { lines: [{}] });
    expect(revalidatePath).toHaveBeenCalledWith("/compras");
    expect(revalidatePath).toHaveBeenCalledWith("/productos");
  });
});
