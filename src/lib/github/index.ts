/**
 * GitHub ingestion — URL parsing, tree fetch, blob fetch, file filtering.
 *
 * Not implemented yet (Feature 1). A GITHUB_TOKEN is strongly recommended:
 * unauthenticated requests are rate-limited per IP and on Vercel that IP is
 * shared.
 */

export type ParsedRepo = { owner: string; repo: string };

/** Accepts https://github.com/owner/repo and owner/repo; rejects anything else. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function parseRepoUrl(_input: string): ParsedRepo | null {
  throw new Error("Not implemented: parseRepoUrl");
}

/** Directories, extensions and patterns dropped before ranking. */
export const EXCLUDED_DIRS = [
  "node_modules",
  "dist",
  "build",
  ".next",
  "vendor",
  "target",
  ".git",
];

/** Hard caps — the caps are a feature, not a limitation to remove later. */
export const MAX_FILES = 60;
export const MAX_TOTAL_BYTES = 400_000;
export const MAX_FILE_BYTES = 100_000;
export const MIN_SOURCE_FILES = 5;
