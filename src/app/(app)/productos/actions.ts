"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { DomainError } from "@/server/errors";
import { createProduct, updateProduct } from "@/server/services/products";
import { requireRole } from "@/server/tenant";

// Server actions: thin adapters between forms and the service layer.
// They authorize, call the service and translate expected errors to form state.

export type ProductFormState = { errors?: Record<string, string>; message?: string };

export async function createProductAction(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const ctx = await requireRole("ADMIN");
  try {
    await createProduct(ctx, Object.fromEntries(formData));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/productos");
  redirect("/productos?ok=creado");
}

export async function updateProductAction(
  id: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const ctx = await requireRole("ADMIN");
  try {
    await updateProduct(ctx, id, Object.fromEntries(formData));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/productos");
  redirect("/productos?ok=actualizado");
}

function toFormState(e: unknown): ProductFormState {
  if (e instanceof ZodError) {
    const errors: Record<string, string> = {};
    for (const issue of e.issues) {
      const field = String(issue.path[0] ?? "form");
      errors[field] ??= issue.message;
    }
    return { errors };
  }
  if (e instanceof DomainError) {
    return e.field ? { errors: { [e.field]: e.message } } : { message: e.message };
  }
  throw e;
}
