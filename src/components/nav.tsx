"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, Package, Settings, ShoppingCart, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/pos", label: "Caja (POS)", icon: ShoppingCart },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/compras", label: "Compras", icon: Truck, adminOnly: true },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/config", label: "Configuración", icon: Settings, adminOnly: true },
];

export function Nav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
      {items
        .filter((i) => !i.adminOnly || isAdmin)
        .map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "hover:bg-muted flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap",
                active && "bg-muted font-medium",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
    </nav>
  );
}
