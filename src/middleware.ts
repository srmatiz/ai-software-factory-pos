import NextAuth from "next-auth";
import { authConfig } from "@/server/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Protect everything except auth API, static assets and the login page logic
  // (handled in the `authorized` callback).
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webmanifest)$).*)"],
};
