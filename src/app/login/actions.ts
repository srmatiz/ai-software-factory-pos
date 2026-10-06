"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/server/auth";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
    return {};
  } catch (e) {
    // signIn redirects by throwing; only swallow real auth failures.
    if (e instanceof AuthError) return { error: "Email o contraseña incorrectos" };
    throw e;
  }
}
