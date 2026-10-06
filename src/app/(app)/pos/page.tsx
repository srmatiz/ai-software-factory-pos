import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Caja (POS)" };

export default function Page() {
  return (
    <ComingSoon title="Caja (POS)" description="Venta con escáner, ticket térmico, cajón de dinero y modo offline." />
  );
}
