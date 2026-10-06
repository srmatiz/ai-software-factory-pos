"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ScanBarcode } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { Decimal, formatMoney, formatPercent, marginPercent, unitProfit } from "@/lib/money";
import type { ProductFormState } from "./actions";

export type ProductFormValues = {
  name: string;
  barcode: string;
  sku: string;
  categoryId: string;
  salePrice: string;
  cost: string;
  taxRate: string;
  minStock: string;
  initialStock: string;
};

type Props = {
  mode: "create" | "edit";
  action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  initialValues: ProductFormValues;
  categories: { id: string; name: string }[];
  currency: string;
  currentStock?: string;
};

function parseAmount(v: string): Decimal | null {
  const n = Number(v.trim().replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) ? new Decimal(n) : null;
}

export function ProductForm({ mode, action, initialValues, categories, currency, currentStock }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState(initialValues);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const set = (field: keyof ProductFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  // A scan anywhere on the page fills the barcode field. If the cursor was in
  // another text field, the scanner already "typed" the code there: remove it.
  useBarcodeScanner((code, target) => {
    const field = target instanceof HTMLInputElement ? (target.name as keyof ProductFormValues) : null;
    setValues((v) => {
      const next = { ...v, barcode: code };
      if (field && field !== "barcode" && field in v && v[field].endsWith(code)) {
        next[field] = v[field].slice(0, -code.length);
      }
      return next;
    });
    setLastScan(code);
  });

  const price = parseAmount(values.salePrice);
  const cost = parseAmount(values.cost);
  const profit = price && cost ? unitProfit(price, cost) : null;
  const margin = price && cost ? marginPercent(price, cost) : null;

  const err = (f: string) => state.errors?.[f];
  const field = (name: keyof ProductFormValues, label: string, props: React.ComponentProps<"input"> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        value={values[name]}
        onChange={set(name)}
        aria-invalid={!!err(name)}
        aria-describedby={err(name) ? `${name}-error` : undefined}
        {...props}
      />
      {err(name) && (
        <p id={`${name}-error`} className="text-destructive text-sm">
          {err(name)}
        </p>
      )}
    </div>
  );

  const decimalInput = { inputMode: "decimal" as const, autoComplete: "off" };

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state.message && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {field("name", "Nombre *", { required: true, autoFocus: mode === "create" })}
        </div>
        <div className="space-y-1.5">
          {field("barcode", "Código de barras", {
            autoComplete: "off",
            placeholder: "Escanea o escribe el código",
            // Scanners end with Enter: never submit the form from this field.
            onKeyDown: (e) => e.key === "Enter" && e.preventDefault(),
          })}
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <ScanBarcode className="size-3.5" />
            {lastScan ? `Código leído: ${lastScan}` : "Puedes escanear con el lector en cualquier momento"}
          </p>
        </div>
        {field("sku", "SKU / referencia interna", { autoComplete: "off" })}
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">Categoría</Label>
          <select
            id="categoryId"
            name="categoryId"
            value={values.categoryId}
            onChange={set("categoryId")}
            className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {err("categoryId") && <p className="text-destructive text-sm">{err("categoryId")}</p>}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <h2 className="font-medium">Precio y costo</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {field("cost", "Costo de adquisición *", { ...decimalInput, required: true })}
          {field("salePrice", "Precio de venta *", { ...decimalInput, required: true })}
          {field("taxRate", "Impuesto %", decimalInput)}
        </div>
        <div className="flex flex-wrap gap-6 text-sm" data-testid="margin-preview">
          <span>
            Utilidad por unidad:{" "}
            <strong className={profit?.isNegative() ? "text-destructive" : undefined}>
              {profit ? formatMoney(profit, currency) : "—"}
            </strong>
          </span>
          <span>
            Margen:{" "}
            <strong className={margin?.isNegative() ? "text-destructive" : undefined}>
              {margin ? formatPercent(margin) : "—"}
            </strong>
          </span>
        </div>
        {profit?.isNegative() && (
          <p className="text-destructive text-sm">Atención: el precio de venta es menor que el costo.</p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {mode === "create" ? (
          field("initialStock", "Stock inicial", decimalInput)
        ) : (
          <div className="space-y-1.5">
            <Label>Stock actual</Label>
            <p className="h-8 py-1 text-sm tabular-nums">{currentStock}</p>
            <p className="text-muted-foreground text-xs">El stock se modifica con compras y ajustes de inventario.</p>
          </div>
        )}
        {field("minStock", "Stock mínimo (alerta)", decimalInput)}
      </section>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : mode === "create" ? "Crear producto" : "Guardar cambios"}
        </Button>
        <Link href="/productos" className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
