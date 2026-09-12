import { defineConfig } from "vitest/config";
import path from "node:path";

const here = import.meta.dirname;

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      // Must come before "@" so it is matched first.
      "server-only": path.resolve(here, "./src/test/server-only-stub.ts"),
      "@": path.resolve(here, "./src"),
    },
  },
});
