import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    businessId: string;
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      businessId: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    businessId?: string;
    role?: Role;
  }
}
