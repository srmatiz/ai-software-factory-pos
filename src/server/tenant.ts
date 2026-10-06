import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/server/auth";

export type TenantContext = {
  businessId: string;
  userId: string;
  role: Role;
};

/**
 * Resolves the current tenant from the session. This is the ONLY place a
 * businessId may come from: never trust a businessId sent by the client.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.businessId || !user.role) redirect("/login");
  return { businessId: user.businessId, userId: user.id, role: user.role };
}

export async function requireRole(...roles: Role[]): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!roles.includes(ctx.role)) redirect("/dashboard?error=forbidden");
  return ctx;
}
