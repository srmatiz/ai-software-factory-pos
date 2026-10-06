import { z } from "zod";

// Validates server environment variables once at startup.
// Values come from .env locally and from the hosting provider's secret
// store in production; nothing secret is ever committed (see .env.example).
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables. Copy .env.example to .env and fill it in.");
}

export const env = parsed.data;
