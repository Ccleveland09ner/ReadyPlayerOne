/**
 * Rate limiting for the expensive routes.
 *
 * Two different jobs here, and they are not the same thing:
 *
 *   - `rateLimit()` throttles CALLERS. Per-IP on /api/runs, which is the route
 *     that costs GitHub quota and embedding credits.
 *   - `GITHUB_BUDGET` / `MODEL_BUDGET` throttle US. They cap how hard one
 *     process leans on an upstream provider regardless of who asked.
 *
 * The store is in-process. On serverless that means per-instance, not global,
 * which is worth stating plainly: it blunts a single abusive client hitting
 * one warm instance, and it does nothing against a distributed flood. For
 * judging-day scale that is the right trade -- a shared Redis would be another
 * account, another key and another failure mode at hour 2. If this outlives
 * the hackathon, move the counters to Postgres or Upstash and keep this
 * interface.
 */

export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Sliding-window-ish fixed window. Good enough, and it cannot leak memory. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): { ok: true } | { ok: false; retryAfterMs: number } {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    sweep(now);
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true };
}

/** Drops expired buckets so a long-lived instance does not grow forever. */
function sweep(now: number) {
  if (buckets.size < 512) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Test seam. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * Best-effort client identity. Vercel sets x-forwarded-for; the first entry is
 * the client. Falls back to a constant, which makes the limit global rather
 * than per-caller -- deliberately fail-closed-ish rather than fail-open.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Creating runs is what costs money. 10 per 5 minutes per caller. */
export const RUN_CREATE_LIMIT = 10;
export const RUN_CREATE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Outbound budgets, applied per process.
 *
 * GitHub: unauthenticated is 60 requests/hour per IP and on Vercel that IP is
 * shared, so the real fix is a token -- this just keeps one instance from
 * being the reason everyone else gets throttled.
 *
 * Model: one generation call per quiz is the design, so anything above a
 * trickle means a retry loop has gone wrong.
 */
export const GITHUB_BUDGET = { limit: 120, windowMs: 60 * 1000 };
export const MODEL_BUDGET = { limit: 20, windowMs: 60 * 1000 };

/** Throws rather than returning, so a caller cannot forget to check. */
export function consumeBudget(
  name: "github" | "model",
  budget: { limit: number; windowMs: number },
): void {
  const result = rateLimit(`budget:${name}`, budget.limit, budget.windowMs);
  if (!result.ok) {
    throw new RateLimitError(
      name === "github"
        ? "Too many GitHub requests from this server right now. Try again shortly."
        : "Too many generation requests from this server right now. Try again shortly.",
      result.retryAfterMs,
    );
  }
}
