import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusiness } from "@/server/services/business";
import { getProduct, listCategories } from "@/server/services/products";
import { requireRole } from "@/server/tenant";
import { updateProductAction } from "../../actions";
import { ProductForm } from "../../product-form";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireRole("ADMIN");
  const [business, categories, product] = await Promise.all([
    getBusiness(ctx),
    listCategories(ctx),
    getProduct(ctx, id),
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar producto</h1>
      <ProductForm
        mode="edit"
        action={updateProductAction.bind(null, product.id)}
        categories={categories.map(({ id, name }) => ({ id, name }))}
        currency={business.currency}
        currentStock={product.stock.toString()}
        initialValues={{
          name: product.name,
          barcode: product.barcode ?? "",
          sku: product.sku ?? "",
          categoryId: product.categoryId ?? "",
          // Decimals are serialized as strings for the client component.
          salePrice: product.salePrice.toString(),
          cost: product.cost.toString(),
          taxRate: product.taxRate.toString(),
          minStock: product.minStock.toString(),
          initialStock: "0",
        }}
      />
    </div>
  );
}
