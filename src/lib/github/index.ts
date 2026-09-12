/**
 * GitHub ingestion -- URL parsing, tree fetch, blob fetch, file filtering.
 *
 * A GITHUB_TOKEN is strongly recommended: unauthenticated requests are
 * rate-limited per IP, and on Vercel that IP is shared.
 *
 * `parseRepoUrl` and the filtering helpers are pure and have no dependency on
 * the environment, so they are safe to import from tests.
 */

import { env } from "@/lib/env";
import { GITHUB_BUDGET, consumeBudget } from "@/lib/ratelimit";
import { HttpishError, withRetry } from "@/lib/retry";
import { log } from "@/lib/log";

export type ParsedRepo = { owner: string; repo: string };

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Accepts `https://github.com/owner/repo` (with optional .git, trailing slash,
 * or extra path segments) and the bare `owner/repo` shorthand. Anything that
 * is not GitHub is rejected -- one ingestion path done well beats three
 * half-working ones.
 */
export function parseRepoUrl(input: string): ParsedRepo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let owner: string | undefined;
  let repo: string | undefined;

  if (trimmed.includes("://") || trimmed.toLowerCase().startsWith("git@")) {
    const normalized = trimmed.replace(/^git@([^:]+):/, "https://$1/");
    let url: URL;
    try {
      url = new URL(normalized);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "github.com") return null;
    [owner, repo] = url.pathname.split("/").filter(Boolean);
  } else {
    const withoutHost = trimmed.replace(/^(?:www\.)?github\.com\//i, "");
    [owner, repo] = withoutHost.split("/").filter(Boolean);
  }

  if (!owner || !repo) return null;
  repo = repo.replace(/\.git$/i, "");

  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo)) return null;
  if (repo === "." || repo === "..") return null;

  return { owner, repo };
}

// --- Filtering --------------------------------------------------------------

/** Build output, dependencies and vendored code carry no signal about intent. */
export const EXCLUDED_DIRS = [
  "node_modules",
  "dist",
  "build",
  ".next",
  "vendor",
  "target",
  ".git",
  "out",
  "coverage",
  ".venv",
  "__pycache__",
];

const EXCLUDED_EXTENSIONS = [
  // binaries and archives
  ".exe", ".dll", ".so", ".dylib", ".bin", ".wasm", ".jar", ".zip", ".gz",
  ".tar", ".tgz", ".7z", ".rar", ".pdf",
  // images, fonts, media
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".svg", ".avif",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp3", ".mp4", ".wav", ".mov", ".avi", ".webm", ".ogg",
  // data blobs and compiled artifacts
  ".lock", ".map", ".pyc", ".class", ".o", ".a", ".db", ".sqlite",
];

const LOCKFILES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "poetry.lock",
  "Pipfile.lock",
  "Gemfile.lock",
  "composer.lock",
  "Cargo.lock",
  "go.sum",
];

/** Manifests and docs rank first -- they state intent, and questions need it. */
const MANIFESTS = [
  "readme.md",
  "readme",
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "cargo.toml",
  "gemfile",
  "composer.json",
  "pom.xml",
  "build.gradle",
  "contributing.md",
  "architecture.md",
];

const CONFIG_HINTS = [
  "dockerfile",
  "docker-compose",
  ".github/workflows/",
  "vercel.json",
  "netlify.toml",
  "next.config",
  "vite.config",
  "tsconfig.json",
  "makefile",
  "procfile",
  ".env.example",
];

const ENTRY_HINTS = [
  "index.",
  "main.",
  "app.",
  "server.",
  "cli.",
  "__main__.",
];

/** Hard caps. These are a feature, not a limitation to remove later. */
export const MAX_FILES = 60;
export const MAX_TOTAL_BYTES = 400_000;
export const MAX_FILE_BYTES = 100_000;
export const MIN_SOURCE_FILES = 5;

export type TreeEntry = { path: string; size: number };

export type FilteredFile = {
  path: string;
  byteSize: number;
  included: boolean;
  skipReason: string | null;
};

/** Returns a skip reason, or null when the file survives filtering. */
export function skipReasonFor(entry: TreeEntry): string | null {
  const path = entry.path;
  const lower = path.toLowerCase();
  const segments = lower.split("/");
  const name = segments[segments.length - 1];

  if (segments.slice(0, -1).some((s) => EXCLUDED_DIRS.includes(s))) {
    return "excluded_directory";
  }
  if (LOCKFILES.some((l) => name === l.toLowerCase())) return "lockfile";
  if (/\.min\.[a-z0-9]+$/.test(name)) return "minified";
  if (EXCLUDED_EXTENSIONS.some((ext) => name.endsWith(ext))) return "binary_or_asset";
  if (entry.size > MAX_FILE_BYTES) return "too_large";
  if (entry.size === 0) return "empty";

  return null;
}

/** Lower sorts first. Manifests, then config and entry points, then depth. */
function rankOf(path: string): number {
  const lower = path.toLowerCase();
  const name = lower.split("/").pop() ?? lower;
  const depth = lower.split("/").length;

  if (MANIFESTS.includes(name)) return 0;
  if (CONFIG_HINTS.some((h) => lower.includes(h))) return 1;
  if (ENTRY_HINTS.some((h) => name.startsWith(h))) return 2;
  return 3 + depth;
}

/**
 * Applies the filters, ranks what survives, then keeps files until either cap
 * binds. Every entry is returned -- the ones that did not make it carry a skip
 * reason, so the UI can report what was left out and the citation verifier
 * knows the snapshot's exact boundaries.
 */
export function selectFiles(entries: TreeEntry[]): FilteredFile[] {
  const results: FilteredFile[] = [];
  const candidates: TreeEntry[] = [];

  for (const entry of entries) {
    const reason = skipReasonFor(entry);
    if (reason) {
      results.push({
        path: entry.path,
        byteSize: entry.size,
        included: false,
        skipReason: reason,
      });
    } else {
      candidates.push(entry);
    }
  }

  candidates.sort((a, b) => {
    const rank = rankOf(a.path) - rankOf(b.path);
    return rank !== 0 ? rank : a.path.localeCompare(b.path);
  });

  let totalBytes = 0;
  let kept = 0;

  for (const entry of candidates) {
    const overFileCap = kept >= MAX_FILES;
    const overByteCap = totalBytes + entry.size > MAX_TOTAL_BYTES;

    if (overFileCap || overByteCap) {
      results.push({
        path: entry.path,
        byteSize: entry.size,
        included: false,
        skipReason: overFileCap ? "file_cap" : "byte_cap",
      });
      continue;
    }

    totalBytes += entry.size;
    kept += 1;
    results.push({
      path: entry.path,
      byteSize: entry.size,
      included: true,
      skipReason: null,
    });
  }

  return results;
}

export function languageOf(path: string): string | null {
  const ext = path.toLowerCase().split(".").pop();
  if (!ext) return null;
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    mjs: "javascript", cjs: "javascript", py: "python", rb: "ruby", go: "go",
    rs: "rust", java: "java", kt: "kotlin", swift: "swift", c: "c", h: "c",
    cpp: "cpp", cc: "cpp", hpp: "cpp", cs: "csharp", php: "php", ex: "elixir",
    exs: "elixir", scala: "scala", sh: "shell", bash: "shell", sql: "sql",
    html: "html", css: "css", scss: "scss", md: "markdown", json: "json",
    yml: "yaml", yaml: "yaml", toml: "toml", tf: "terraform",
  };
  return map[ext] ?? null;
}

// --- API calls --------------------------------------------------------------

async function githubFetch(path: string): Promise<Response> {
  // Our own outbound budget, separate from GitHub's. Keeps one instance from
  // being the reason a shared Vercel IP gets throttled for everyone.
  consumeBudget("github", GITHUB_BUDGET);

  const token = env.githubToken();

  return withRetry(
    async () => {
      let response: Response;
      try {
        response = await fetch(`https://api.github.com${path}`, {
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "ReadyPlayerOne",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        });
      } catch (cause) {
        throw new HttpishError(
          `Could not reach GitHub: ${cause instanceof Error ? cause.message : String(cause)}`,
          503,
        );
      }

      // 403 with a zero remaining header is a rate limit, not a permission
      // problem -- retrying a genuine 403 would be pointless, so read the
      // header rather than guessing from the status.
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (response.status === 403 && remaining === "0") {
        throw new HttpishError("GitHub rate limit reached.", 429);
      }
      if (response.status >= 500 || response.status === 429) {
        throw new HttpishError(`GitHub returned ${response.status}.`, response.status);
      }

      return response;
    },
    {
      attempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      onRetry: ({ attempt, delayMs, error }) =>
        log.warn("ingest.tree", {
          attempt,
          delayMs,
          path,
          error: error instanceof Error ? error.message : String(error),
        }),
    },
  );
}

async function githubJson<T>(path: string, notFoundMessage: string): Promise<T> {
  let response: Response;
  try {
    response = await githubFetch(path);
  } catch (error) {
    // Retries exhausted. Translate to the domain error the routes map on.
    if (error instanceof HttpishError) {
      throw new GitHubError(
        error.status === 429
          ? "GitHub rate limit reached. Set a GITHUB_TOKEN and try again."
          : error.message,
        error.status === 429 ? 429 : 502,
      );
    }
    throw error;
  }

  if (response.status === 404) {
    throw new GitHubError(notFoundMessage, 404);
  }
  if (response.status === 403 || response.status === 429) {
    throw new GitHubError(
      "GitHub rate limit reached. Set a GITHUB_TOKEN and try again.",
      429,
    );
  }
  if (!response.ok) {
    throw new GitHubError(`GitHub request failed (${response.status}).`, 502);
  }

  return (await response.json()) as T;
}

/**
 * A 404 covers both "private" and "does not exist" and GitHub will not say
 * which. Saying so honestly beats guessing.
 */
export async function fetchRepoMeta(
  owner: string,
  repo: string,
): Promise<{ defaultBranch: string }> {
  const data = await githubJson<{ default_branch: string }>(
    `/repos/${owner}/${repo}`,
    `Could not find ${owner}/${repo}. It may be private, or it may not exist -- GitHub does not distinguish the two for us. Public repositories only.`,
  );
  return { defaultBranch: data.default_branch };
}

export async function fetchHeadSha(
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  const data = await githubJson<{ sha: string }>(
    `/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
    `Could not resolve the head commit of ${branch}.`,
  );
  return data.sha;
}

export async function fetchTree(
  owner: string,
  repo: string,
  sha: string,
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const data = await githubJson<{
    tree: { path: string; type: string; size?: number }[];
    truncated: boolean;
  }>(
    `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
    "Could not read the repository tree.",
  );

  return {
    entries: data.tree
      .filter((node) => node.type === "blob")
      .map((node) => ({ path: node.path, size: node.size ?? 0 })),
    truncated: data.truncated,
  };
}

/** Fetches one file's text at the pinned commit. */
export async function fetchBlob(
  owner: string,
  repo: string,
  sha: string,
  path: string,
): Promise<string> {
  const response = await githubFetch(
    `/repos/${owner}/${repo}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${sha}`,
  );

  if (!response.ok) {
    throw new GitHubError(`Could not read ${path} (${response.status}).`, 502);
  }

  const data = (await response.json()) as {
    content?: string;
    encoding?: string;
  };

  if (data.encoding !== "base64" || typeof data.content !== "string") {
    throw new GitHubError(`Unexpected encoding for ${path}.`, 502);
  }

  return Buffer.from(data.content, "base64").toString("utf8");
}
