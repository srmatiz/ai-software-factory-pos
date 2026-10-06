import type { Metadata } from "next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { getBusiness } from "@/server/services/business";
import { getInventorySummary } from "@/server/services/dashboard";
import { getTenantContext } from "@/server/tenant";

export const metadata: Metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const ctx = await getTenantContext();
  const [business, summary] = await Promise.all([getBusiness(ctx), getInventorySummary(ctx)]);
  const money = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, business.currency);

  const tiles = [
    { label: "Productos activos", value: summary.products.toString() },
    { label: "Inventario a costo", value: money(summary.valueAtCost) },
    { label: "Inventario a precio de venta", value: money(summary.valueAtPrice) },
    { label: "Productos con stock bajo", value: summary.lowStock.toString() },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inicio</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader>
              <CardDescription>{t.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{t.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="text-muted-foreground text-sm">
        Las métricas de ventas y utilidades se habilitan con el módulo de Caja (POS).
      </p>
    </div>
  );
}
