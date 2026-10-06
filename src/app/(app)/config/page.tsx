import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/server/tenant";

export const metadata: Metadata = { title: "Configuración" };

export default async function Page() {
  await requireRole("ADMIN");
  return <ComingSoon title="Configuración" description="Datos del negocio, usuarios e impresora." />;
}
