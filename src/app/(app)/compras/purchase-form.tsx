"use client";

import { useState, useTransition } from "react";
import { ScanBarcode, Trash2, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { Decimal, formatMoney } from "@/lib/money";
import {
  costExceedsSalePrice,
  lineSubtotal,
  lineUnitCost,
  purchaseTotal,
  type CostMode,
  type PurchaseLineCost,
} from "@/lib/purchase";
import { createPurchaseAction, lookupProductByBarcodeAction } from "./actions";

type Line = {
  productId: string;
  name: string;
  salePrice: string;
  quantity: string;
  costMode: CostMode;
  cost: string;
};

/** Returns a cost-ready line only when the typed values are valid numbers; otherwise null (no preview). */
function toCostLine(l: Line): PurchaseLineCost | null {
  const cost = l.cost.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cost) || !/^\d+$/.test(l.quantity.trim())) return null;
  const quantity = l.quantity.trim();
  if (new Decimal(quantity).lte(0) || new Decimal(cost).lte(0)) return null;
  return { quantity, costMode: l.costMode, cost };
}

export function PurchaseForm({ currency }: { currency: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const money = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, currency);

  // A scan anywhere on the page adds the product. If the cursor was in a line
  // field, the scanner already "typed" the code there: remove it.
  useBarcodeScanner((code, target) => {
    if (target instanceof HTMLInputElement && target.dataset.lineField) {
      const productId = target.dataset.productId;
      const field = target.dataset.lineField as "quantity" | "cost";
      setLines((ls) =>
        ls.map((l) =>
          l.productId === productId && l[field].endsWith(code) ? { ...l, [field]: l[field].slice(0, -code.length) } : l,
        ),
      );
    }
    setScanError(null);
    setSuccess(null);
    lookupProductByBarcodeAction(code).then((p) => {
      if (!p) {
        setScanError("Código no encontrado");
        return;
      }
      setErrors({});
      setMessage(null);
      setLines((ls) =>
        ls.some((l) => l.productId === p.id)
          ? ls.map((l) =>
              l.productId === p.id
                ? { ...l, quantity: String((/^\d+$/.test(l.quantity) ? Number(l.quantity) : 0) + 1) }
                : l,
            )
          : [
              ...ls,
              { productId: p.id, name: p.name, salePrice: p.salePrice, quantity: "1", costMode: "unit", cost: "" },
            ],
      );
    });
  });

  const update = (productId: string, patch: Partial<Line>) => {
    setErrors({});
    setMessage(null);
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  };

  const remove = (productId: string) => {
    setErrors({});
    setMessage(null);
    setLines((ls) => ls.filter((l) => l.productId !== productId));
  };

  const costLines = lines.map(toCostLine);
  const total = purchaseTotal(costLines.filter((c): c is PurchaseLineCost => c !== null));

  const save = () => {
    setErrors({});
    setMessage(null);
    setSuccess(null);
    setScanError(null);
    startTransition(async () => {
      const result = await createPurchaseAction(
        lines.map((l) => ({ productId: l.productId, quantity: l.quantity, costMode: l.costMode, cost: l.cost })),
      );
      if (result.ok) {
        setLines([]);
        setSuccess(`Compra registrada. Total: ${money(result.total)}`);
      } else {
        setErrors(result.errors ?? {});
        setMessage(result.message ?? null);
      }
    });
  };

  const formError = errors.lines ?? errors.form ?? message;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4"
    >
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <ScanBarcode className="size-4" />
        Escanea el código de barras de cada producto recibido.
      </p>

      {success && (
        <Alert role="status" data-testid="purchase-success">
          {success}
        </Alert>
      )}
      {scanError && <Alert variant="destructive">{scanError}</Alert>}
      {formError && <Alert variant="destructive">{formError}</Alert>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Tipo de costo</TableHead>
            <TableHead>Costo</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                Aún no hay productos en la compra.
              </TableCell>
            </TableRow>
          )}
          {lines.map((l, i) => {
            const cl = costLines[i];
            const qtyErr = errors[`lines.${i}.quantity`];
            const costErr = errors[`lines.${i}.cost`];
            const modeErr = errors[`lines.${i}.costMode`];
            const productErr = errors[`lines.${i}.productId`];
            const warn = cl ? costExceedsSalePrice(cl, l.salePrice) : false;
            return (
              <TableRow key={l.productId}>
                <TableCell className="align-top">
                  <span className="font-medium">{l.name}</span>
                  {productErr && <p className="text-destructive text-sm">{productErr}</p>}
                </TableCell>
                <TableCell className="align-top">
                  <Label htmlFor={`qty-${i}`} className="sr-only">
                    Cantidad de {l.name}
                  </Label>
                  <Input
                    id={`qty-${i}`}
                    value={l.quantity}
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-24"
                    data-line-field="quantity"
                    data-product-id={l.productId}
                    onChange={(e) => update(l.productId, { quantity: e.target.value })}
                    aria-invalid={!!qtyErr}
                    aria-describedby={qtyErr ? `qty-${i}-error` : undefined}
                  />
                  {qtyErr && (
                    <p id={`qty-${i}-error`} className="text-destructive text-sm">
                      {qtyErr}
                    </p>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <Label htmlFor={`mode-${i}`} className="sr-only">
                    Tipo de costo: {l.name}
                  </Label>
                  <select
                    id={`mode-${i}`}
                    value={l.costMode}
                    onChange={(e) => update(l.productId, { costMode: e.target.value as CostMode })}
                    aria-invalid={!!modeErr}
                    aria-describedby={modeErr ? `mode-${i}-error` : undefined}
                    className="border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm"
                  >
                    <option value="unit">Costo unitario</option>
                    <option value="total">Total del lote</option>
                  </select>
                  {modeErr && (
                    <p id={`mode-${i}-error`} className="text-destructive text-sm">
                      {modeErr}
                    </p>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <Label htmlFor={`cost-${i}`} className="sr-only">
                    Costo de {l.name}
                  </Label>
                  <Input
                    id={`cost-${i}`}
                    value={l.cost}
                    inputMode="decimal"
                    autoComplete="off"
                    className="w-32"
                    data-line-field="cost"
                    data-product-id={l.productId}
                    onChange={(e) => update(l.productId, { cost: e.target.value })}
                    aria-invalid={!!costErr}
                    aria-describedby={costErr ? `cost-${i}-error` : undefined}
                  />
                  {costErr && (
                    <p id={`cost-${i}-error`} className="text-destructive text-sm">
                      {costErr}
                    </p>
                  )}
                  {warn && cl && (
                    <p role="status" className="text-destructive flex items-center gap-1 text-sm">
                      <TriangleAlert className="size-4" />
                      Atención: el costo unitario ({money(lineUnitCost(cl))}) es mayor que el precio de venta (
                      {money(l.salePrice)}).
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">
                  {cl ? money(lineSubtotal(cl)) : "—"}
                </TableCell>
                <TableCell className="align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar ${l.name}`}
                    onClick={() => remove(l.productId)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-lg">
          Total: <strong data-testid="purchase-total">{money(total)}</strong>
        </p>
        <Button type="submit" disabled={pending || lines.length === 0}>
          {pending ? "Guardando..." : "Guardar compra"}
        </Button>
      </div>
    </form>
  );
}
