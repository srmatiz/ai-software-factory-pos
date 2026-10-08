import type { Metadata } from "next";
import { getBusiness } from "@/server/services/business";
import { requireRole } from "@/server/tenant";
import { PurchaseForm } from "./purchase-form";

export const metadata: Metadata = { title: "Compras" };

export default async function PurchasesPage() {
  const ctx = await requireRole("ADMIN");
  const business = await getBusiness(ctx);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Compras</h1>
        <p className="text-muted-foreground text-sm">
          Escanea los productos recibidos, indica cantidad y costo, y guarda para actualizar stock y costo promedio.
        </p>
      </div>
      <PurchaseForm currency={business.currency} />
    </div>
  );
}
