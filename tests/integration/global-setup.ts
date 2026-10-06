import { execSync } from "node:child_process";

// Applies migrations to the test database (Prisma creates it if missing).
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://pos:pos_local_dev@localhost:5433/pos_test?schema=public";
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
