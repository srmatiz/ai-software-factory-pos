import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatPercent, marginPercent } from "@/lib/money";
import { getBusiness } from "@/server/services/business";
import { listCategories, listProducts } from "@/server/services/products";
import { getTenantContext } from "@/server/tenant";

export const metadata: Metadata = { title: "Productos" };

type SearchParams = Promise<{ q?: string; categoria?: string; ok?: string }>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, categoria, ok } = await searchParams;
  const ctx = await getTenantContext();
  const [business, categories, products] = await Promise.all([
    getBusiness(ctx),
    listCategories(ctx),
    listProducts(ctx, { q, categoryId: categoria }),
  ]);
  const isAdmin = ctx.role === "ADMIN";
  const money = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, business.currency);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Productos</h1>
        {isAdmin && (
          <Link href="/productos/nuevo" className={buttonVariants()}>
            <Plus /> Nuevo producto
          </Link>
        )}
      </div>

      {ok && (
        <p role="status" className="bg-muted rounded-md px-3 py-2 text-sm">
          Producto {ok === "creado" ? "creado" : "actualizado"} correctamente.
        </p>
      )}

      <form className="flex flex-wrap gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar por nombre, código o SKU" className="max-w-xs" />
        <select
          name="categoria"
          defaultValue={categoria ?? ""}
          aria-label="Categoría"
          className="border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Buscar
        </button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Costo</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Margen</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            {isAdmin && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                No hay productos{q || categoria ? " que coincidan con la búsqueda" : " todavía"}.
              </TableCell>
            </TableRow>
          )}
          {products.map((p) => {
            const margin = marginPercent(p.salePrice.toString(), p.cost.toString());
            const low = p.stock.lte(p.minStock);
            return (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.barcode ?? p.sku ?? "—"}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.category?.name ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{money(p.cost.toString())}</TableCell>
                <TableCell className="text-right tabular-nums">{money(p.salePrice.toString())}</TableCell>
                <TableCell className="text-right tabular-nums">{margin ? formatPercent(margin) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {low ? <Badge variant="destructive">{p.stock.toString()}</Badge> : p.stock.toString()}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Link
                      href={`/productos/${p.id}/editar`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Editar
                    </Link>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
