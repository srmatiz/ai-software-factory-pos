import { describe, expect, it } from "vitest";
import { createPurchaseSchema } from "@/lib/schemas/purchase";

const line = { productId: "p1", quantity: "5", costMode: "unit", cost: "1200" };
const firstError = (l: Record<string, unknown>) => {
  const r = createPurchaseSchema.safeParse({ lines: [{ ...line, ...l }] });
  return r.success ? null : { path: r.error.issues[0].path.join("."), message: r.error.issues[0].message };
};

describe("createPurchaseSchema", () => {
  it("accepts a valid line", () => {
    const r = createPurchaseSchema.parse({ lines: [line] });
    expect(r.lines[0]).toEqual({ productId: "p1", quantity: 5, costMode: "unit", cost: "1200" });
  });

  it("accepts decimal comma in cost", () => {
    expect(createPurchaseSchema.parse({ lines: [{ ...line, cost: "1,5" }] }).lines[0].cost).toBe("1.5");
  });

  it("requires at least one line", () => {
    const r = createPurchaseSchema.safeParse({ lines: [] });
    expect(r.success ? null : r.error.issues[0].message).toBe("Agrega al menos un producto");
  });

  it("requires quantity and cost", () => {
    expect(firstError({ quantity: "" })).toEqual({ path: "lines.0.quantity", message: "La cantidad es obligatoria" });
    expect(firstError({ cost: "" })).toEqual({ path: "lines.0.cost", message: "El costo es obligatorio" });
  });

  it("rejects zero and negative quantity", () => {
    expect(firstError({ quantity: "0" })?.message).toBe("La cantidad debe ser mayor que 0");
    expect(firstError({ quantity: "-3" })?.message).toBe("La cantidad debe ser mayor que 0");
  });

  it("rejects decimal and non-numeric quantity", () => {
    expect(firstError({ quantity: "1.5" })?.message).toBe("La cantidad debe ser un número entero");
    expect(firstError({ quantity: "1,5" })?.message).toBe("La cantidad debe ser un número entero");
    expect(firstError({ quantity: "abc" })?.message).toBe("La cantidad debe ser un número entero");
  });

  it("rejects zero, negative and non-numeric cost", () => {
    expect(firstError({ cost: "0" })?.message).toBe("El costo debe ser mayor que 0");
    expect(firstError({ cost: "-2" })?.message).toBe("El costo debe ser mayor que 0");
    expect(firstError({ cost: "abc" })?.message).toBe("El costo debe ser un número");
  });

  it("accepts very small values and rejects too many decimals", () => {
    expect(firstError({ cost: "0,0001" })).toBeNull();
    expect(firstError({ cost: "0,00001" })?.message).toBe("El costo admite hasta 4 decimales");
    expect(firstError({ costMode: "total", cost: "10,001" })?.message).toBe(
      "El total del lote admite hasta 2 decimales",
    );
  });

  it("rejects values above the column limits", () => {
    expect(firstError({ quantity: "1000000000" })?.message).toBe("La cantidad es demasiado alta");
    expect(firstError({ cost: "100000000" })?.message).toBe("El costo es demasiado alto");
    expect(firstError({ costMode: "total", cost: "10000000000" })?.message).toBe("El total del lote es demasiado alto");
    expect(firstError({ quantity: "999999999", cost: "99999999,9999" })).toBeNull();
  });

  it("rejects an unknown cost mode and a missing product", () => {
    expect(firstError({ costMode: "x" })?.path).toBe("lines.0.costMode");
    expect(firstError({ productId: "" })?.message).toBe("Producto no válido");
  });
});
