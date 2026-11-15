import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { loadEnvConfig } = nextEnv;
const nodeEnv = process.env.NODE_ENV;
Reflect.set(process.env, "NODE_ENV", "development");
loadEnvConfig(process.cwd(), true);
Reflect.set(process.env, "NODE_ENV", nodeEnv);

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    env: {
      RUN_SUPABASE_INTEGRATION_TESTS:
        process.env.RUN_SUPABASE_INTEGRATION_TESTS ?? "false",
      SUPABASE_INTEGRATION_ALLOW_WRITES:
        process.env.SUPABASE_INTEGRATION_ALLOW_WRITES ?? "false",
      SUPABASE_INTEGRATION_PROJECT_REF:
        process.env.SUPABASE_INTEGRATION_PROJECT_REF ?? "",
      SUPABASE_ADMIN_INTEGRATION_USER_ID:
        process.env.SUPABASE_ADMIN_INTEGRATION_USER_ID ?? "",
      SUPABASE_ADMIN_INTEGRATION_EMAIL:
        process.env.SUPABASE_ADMIN_INTEGRATION_EMAIL ?? "",
      SUPABASE_ADMIN_INTEGRATION_PASSWORD:
        process.env.SUPABASE_ADMIN_INTEGRATION_PASSWORD ?? "",
      ADMIN_CRON_SECRET: process.env.ADMIN_CRON_SECRET ?? "",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(
        __dirname,
        "./node_modules/next/dist/compiled/server-only/empty.js"
      ),
    },
  },
});
