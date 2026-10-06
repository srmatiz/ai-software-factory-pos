import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Compras" };

export default function Page() {
  return (
    <ComingSoon
      title="Compras"
      description="Registro de mercancía recibida con actualización de stock y costo promedio."
    />
  );
}
