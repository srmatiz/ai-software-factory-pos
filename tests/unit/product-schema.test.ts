import { describe, expect, it } from "vitest";
import { createProductSchema } from "@/lib/schemas/product";

const valid = { name: "Agua", salePrice: "2500", cost: "1200" };
const firstError = (input: Record<string, unknown>) => {
  const r = createProductSchema.safeParse(input);
  return r.success ? null : { field: r.error.issues[0].path[0], message: r.error.issues[0].message };
};

describe("createProductSchema", () => {
  it("accepts a minimal product and applies defaults", () => {
    const r = createProductSchema.parse(valid);
    expect(r).toMatchObject({ name: "Agua", salePrice: 2500, cost: 1200, taxRate: 0, minStock: 0, initialStock: 0 });
    expect(r.barcode).toBeUndefined();
  });

  it("requires sale price and cost (empty string is not zero)", () => {
    expect(firstError({ ...valid, salePrice: "" })).toEqual({
      field: "salePrice",
      message: "El precio de venta es obligatorio",
    });
    expect(firstError({ ...valid, cost: undefined })).toEqual({ field: "cost", message: "El costo es obligatorio" });
  });

  it("rejects negative and non-numeric amounts", () => {
    expect(firstError({ ...valid, cost: "-1" })?.message).toBe("El costo no puede ser negativo");
    expect(firstError({ ...valid, salePrice: "abc" })?.message).toBe("El precio de venta debe ser un número");
    expect(firstError({ ...valid, initialStock: "-5" })?.field).toBe("initialStock");
  });

  it("accepts a comma as decimal separator", () => {
    expect(createProductSchema.parse({ ...valid, cost: "1200,50" }).cost).toBe(1200.5);
  });

  it("allows zero cost (e.g. gifted stock) and zero price", () => {
    expect(createProductSchema.safeParse({ ...valid, cost: "0", salePrice: "0" }).success).toBe(true);
  });

  it("trims text and turns blank optional fields into undefined", () => {
    const r = createProductSchema.parse({ ...valid, name: "  Agua  ", barcode: "   ", sku: " A-1 " });
    expect(r.name).toBe("Agua");
    expect(r.barcode).toBeUndefined();
    expect(r.sku).toBe("A-1");
  });

  it("requires a name", () => {
    expect(firstError({ ...valid, name: "   " })?.field).toBe("name");
  });
});
