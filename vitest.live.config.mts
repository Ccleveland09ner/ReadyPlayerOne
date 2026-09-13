import { defineConfig } from "vitest/config";
import path from "node:path";

const here = import.meta.dirname;

/**
 * The live suite: tests that talk to the real Supabase project.
 *
 * A standalone config rather than a merge of `vitest.config.mts`, because
 * merging concatenates `include`/`exclude` and would run the offline suite
 * here too. `npm test` must stay offline, free and deterministic; a test that
 * needs credentials and a network is none of those. Run with
 * `npm run test:live`.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.live.test.ts"],
    environment: "node",
    // One shared database, so the files must not race each other on it.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "server-only": path.resolve(here, "./src/test/server-only-stub.ts"),
      "@": path.resolve(here, "./src"),
    },
  },
});
