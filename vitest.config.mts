import { defineConfig } from "vitest/config";
import path from "node:path";

const here = import.meta.dirname;

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // *.live.test.ts talks to the real Supabase project, so it is not part of
    // the default suite: `npm test` must stay offline, free and deterministic.
    // Run those with `npm run test:live`.
    exclude: ["**/node_modules/**", "src/**/*.live.test.ts"],
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
