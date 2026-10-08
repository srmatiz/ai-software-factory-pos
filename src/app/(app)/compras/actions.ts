"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { DomainError } from "@/server/errors";
import { createPurchase } from "@/server/services/purchases";
import { findProductByBarcode } from "@/server/services/products";
import { requireRole } from "@/server/tenant";

// Server actions: thin adapters between the purchase form and the service layer.

export type PurchaseActionState =
  { ok: true; id: string; total: string } | { ok: false; errors?: Record<string, string>; message?: string };

export type LookedUpProduct = {
  id: string;
  name: string;
  barcode: string | null;
  salePrice: string;
  cost: string;
  stock: string;
  active: boolean;
};

export async function lookupProductByBarcodeAction(barcode: string): Promise<LookedUpProduct | null> {
  const ctx = await requireRole("ADMIN");
  const code = String(barcode ?? "").trim();
  if (!code) return null;
  const p = await findProductByBarcode(ctx, code);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    salePrice: p.salePrice.toString(),
    cost: p.cost.toString(),
    stock: p.stock.toString(),
    active: p.active,
  };
}

export async function createPurchaseAction(lines: unknown): Promise<PurchaseActionState> {
  const ctx = await requireRole("ADMIN");
  try {
    const purchase = await createPurchase(ctx, { lines });
    revalidatePath("/compras");
    revalidatePath("/productos");
    return { ok: true, id: purchase.id, total: purchase.total.toString() };
  } catch (e) {
    return toFormState(e);
  }
}

function toFormState(e: unknown): PurchaseActionState {
  if (e instanceof ZodError) {
    const errors: Record<string, string> = {};
    for (const issue of e.issues) {
      const key = issue.path.length ? issue.path.join(".") : "form";
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  if (e instanceof DomainError) {
    return { ok: false, ...(e.field ? { errors: { [e.field]: e.message } } : { message: e.message }) };
  }
  throw e;
}
