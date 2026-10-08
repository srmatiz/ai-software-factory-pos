import { z } from "zod";

// Purchase lines arrive as strings from the form. Costs stay as normalized
// decimal strings (never floats) and are converted to Decimal in the service.

export const MAX_QUANTITY = 999_999_999; // Decimal(12,3) integer part
export const MAX_UNIT_COST = "99999999.9999"; // Decimal(12,4)
export const MAX_BATCH_TOTAL = "9999999999.99"; // Decimal(12,2)

const trimmed = (v: unknown) => (typeof v === "string" ? v.trim() : v);

const quantity = z.preprocess(
  (v) => {
    const s = trimmed(v);
    if (s === "" || s === null || s === undefined) return undefined;
    if (typeof s === "string") return /^-?\d+$/.test(s) ? Number(s) : Number.NaN;
    return s;
  },
  z
    .number({
      error: (iss) =>
        iss.input === undefined ? "La cantidad es obligatoria" : "La cantidad debe ser un número entero",
    })
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad debe ser mayor que 0")
    .max(MAX_QUANTITY, "La cantidad es demasiado alta"),
);

/** Normalizes the decimal comma and validates the shape; returns a plain decimal string. */
const cost = z.preprocess(
  (v) => {
    const s = trimmed(v);
    if (s === "" || s === null || s === undefined) return undefined;
    return typeof s === "string" ? s.replace(",", ".") : String(s);
  },
  z
    .string({ error: (iss) => (iss.input === undefined ? "El costo es obligatorio" : "El costo debe ser un número") })
    .regex(/^-?\d+(\.\d+)?$/, "El costo debe ser un número"),
);

export const purchaseLineSchema = z
  .object({
    productId: z.string().trim().min(1, "Producto no válido"),
    quantity,
    costMode: z.enum(["unit", "total"], { error: "Elige cómo ingresar el costo" }),
    cost,
  })
  .superRefine((line, ctx) => {
    const value = Number(line.cost);
    if (value <= 0) {
      ctx.addIssue({ code: "custom", path: ["cost"], message: "El costo debe ser mayor que 0" });
      return;
    }
    const decimals = line.cost.split(".")[1]?.length ?? 0;
    if (line.costMode === "unit") {
      if (decimals > 4) ctx.addIssue({ code: "custom", path: ["cost"], message: "El costo admite hasta 4 decimales" });
      else if (value > Number(MAX_UNIT_COST))
        ctx.addIssue({ code: "custom", path: ["cost"], message: "El costo es demasiado alto" });
    } else {
      if (decimals > 2)
        ctx.addIssue({ code: "custom", path: ["cost"], message: "El total del lote admite hasta 2 decimales" });
      else if (value > Number(MAX_BATCH_TOTAL))
        ctx.addIssue({ code: "custom", path: ["cost"], message: "El total del lote es demasiado alto" });
    }
  });

export const createPurchaseSchema = z.object({
  lines: z.array(purchaseLineSchema).min(1, "Agrega al menos un producto"),
});

export type PurchaseLineInput = z.infer<typeof purchaseLineSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
