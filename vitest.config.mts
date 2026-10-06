import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

// Integration tests run against a separate database (never the dev one).
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://pos:pos_local_dev@localhost:5433/pos_test?schema=public";

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          env: {
            DATABASE_URL: TEST_DATABASE_URL,
            AUTH_SECRET: "test-secret-not-used-for-anything-real-000",
          },
          fileParallelism: false,
        },
      },
    ],
  },
});
