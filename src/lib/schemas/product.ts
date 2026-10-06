import { z } from "zod";

// Form inputs arrive as strings. Empty strings become `undefined` so required
// fields fail with a clear message instead of silently coercing to 0.
// Numbers are converted to Decimal in the service layer.
function toNumber(v: unknown) {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "string") return Number(v.trim().replace(",", "."));
  return v;
}

const requiredAmount = (label: string) =>
  z.preprocess(
    toNumber,
    z
      .number({
        error: (iss) => (iss.input === undefined ? `${label} es obligatorio` : `${label} debe ser un número`),
      })
      .min(0, `${label} no puede ser negativo`)
      .max(9_999_999_999, `${label} es demasiado alto`),
  );

const optionalAmount = (label: string, max = 9_999_999_999) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: `${label} debe ser un número` })
      .min(0, `${label} no puede ser negativo`)
      .max(max, `${label} es demasiado alto`)
      .default(0),
  );

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
  z.string().max(64).optional(),
);

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  barcode: optionalText,
  sku: optionalText,
  categoryId: optionalText,
  salePrice: requiredAmount("El precio de venta"),
  cost: requiredAmount("El costo"),
  taxRate: optionalAmount("El impuesto", 100),
  minStock: optionalAmount("El stock mínimo"),
});

export const createProductSchema = productInputSchema.extend({
  initialStock: optionalAmount("El stock inicial"),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
