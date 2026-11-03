import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup/env.ts", "./tests/setup/jsdom.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 15000,
    hookTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: [
        "lib/pix.ts",
        "lib/pedidos.ts",
        "lib/rate-limit.ts",
        "lib/request-guards.ts",
        "app/api/pix/**",
        "app/api/webhooks/**",
        "app/api/orders/**",
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 75,
      },
    },
  },
});
