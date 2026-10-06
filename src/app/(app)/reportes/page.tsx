import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Reportes" };

export default function Page() {
  return <ComingSoon title="Reportes" description="Inventario, ventas, costos, utilidades y kardex por producto." />;
}
