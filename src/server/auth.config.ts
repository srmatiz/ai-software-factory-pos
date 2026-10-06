import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe config shared by middleware and the full auth setup.
// No database or bcrypt imports here.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = request.nextUrl.pathname.startsWith("/login");
      if (isLoginPage) {
        return isLoggedIn ? Response.redirect(new URL("/dashboard", request.nextUrl)) : true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.businessId = user.businessId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.businessId = token.businessId as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
} satisfies NextAuthConfig;
