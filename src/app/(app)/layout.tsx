import { LogOut } from "lucide-react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/server/auth";
import { getBusiness } from "@/server/services/business";
import { getTenantContext } from "@/server/tenant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();
  const [session, business] = await Promise.all([auth(), getBusiness(ctx)]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-muted/30 border-b p-4 md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="mb-4">
          <p className="font-semibold">{business.name}</p>
          <p className="text-muted-foreground text-xs">
            {session?.user?.name} · {ctx.role === "ADMIN" ? "Administrador" : "Cajero"}
          </p>
        </div>
        <Nav isAdmin={ctx.role === "ADMIN"} />
        <form
          className="mt-4"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
            <LogOut /> Salir
          </Button>
        </form>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
