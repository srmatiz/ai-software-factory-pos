import type { Metadata } from "next";
import { getBusiness } from "@/server/services/business";
import { listCategories } from "@/server/services/products";
import { requireRole } from "@/server/tenant";
import { createProductAction } from "../actions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const ctx = await requireRole("ADMIN");
  const [business, categories] = await Promise.all([getBusiness(ctx), listCategories(ctx)]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo producto</h1>
      <ProductForm
        mode="create"
        action={createProductAction}
        categories={categories.map(({ id, name }) => ({ id, name }))}
        currency={business.currency}
        initialValues={{
          name: "",
          barcode: "",
          sku: "",
          categoryId: "",
          salePrice: "",
          cost: "",
          taxRate: business.defaultTaxRate.toString(),
          minStock: "0",
          initialStock: "0",
        }}
      />
    </div>
  );
}
