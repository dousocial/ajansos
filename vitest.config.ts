import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config — kritik birim testler.
 *
 * Hedef: pure utility/business logic katmanları (crypto, invoice math,
 * publish dispatcher branching). UI/E2E ileride Playwright ile.
 *
 * Path alias `@/*` → `src/*` (tsconfig ile aynı).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "src/lib/prisma.ts"],
    },
  },
});
