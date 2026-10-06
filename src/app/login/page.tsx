import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <main className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>POS Inventario</CardTitle>
          <CardDescription>Ingresa con tu cuenta</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
