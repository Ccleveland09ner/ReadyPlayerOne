import { describe, expect, it, vi } from "vitest";
import {
  HttpishError,
  backoffDelay,
  defaultIsRetryable,
  isRetryableStatus,
  withRetry,
} from "@/lib/retry";
import {
  RUN_CREATE_LIMIT,
  RateLimitError,
  clientKey,
  consumeBudget,
  rateLimit,
  resetRateLimits,
} from "@/lib/ratelimit";

/**
 * Retry policy and rate limiting.
 *
 * Retrying the wrong thing is worse than not retrying: a 400 will be a 400
 * again, and three attempts at it just triple the latency before the same
 * failure. These tests pin which errors are worth a second try.
 */

const noSleep = () => Promise.resolve();

describe("isRetryableStatus", () => {
  it("retries transient statuses", () => {
    for (const status of [408, 409, 429, 500, 502, 503, 504]) {
      expect(isRetryableStatus(status)).toBe(true);
    }
  });

  it("does not retry client mistakes", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isRetryableStatus(status)).toBe(false);
    }
  });
});

describe("defaultIsRetryable", () => {
  it("retries network failures", () => {
    expect(defaultIsRetryable(new TypeError("fetch failed"))).toBe(true);
  });

  it("reads a status off a plain error object", () => {
    expect(defaultIsRetryable({ status: 503 })).toBe(true);
    expect(defaultIsRetryable({ status: 400 })).toBe(false);
  });

  it("does not retry an error it cannot classify", () => {
    expect(defaultIsRetryable(new Error("something odd"))).toBe(false);
  });
});

describe("backoffDelay", () => {
  it("grows exponentially at the ceiling", () => {
    const full = () => 1;
    expect(backoffDelay(1, 100, 10_000, full)).toBe(100);
    expect(backoffDelay(2, 100, 10_000, full)).toBe(200);
    expect(backoffDelay(3, 100, 10_000, full)).toBe(400);
  });

  it("clamps to the maximum", () => {
    expect(backoffDelay(20, 100, 5_000, () => 1)).toBe(5_000);
  });

  it("jitters below the ceiling", () => {
    // Full jitter: several failures at once must not retry in lockstep.
    expect(backoffDelay(3, 100, 10_000, () => 0)).toBe(0);
    expect(backoffDelay(3, 100, 10_000, () => 0.5)).toBe(200);
  });
});

describe("withRetry", () => {
  it("returns the first success without sleeping", async () => {
    const sleep = vi.fn(noSleep);
    const operation = vi.fn().mockResolvedValue("ok");

    expect(await withRetry(operation, { sleep })).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a transient failure and then succeeds", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new HttpishError("rate limited", 429))
      .mockResolvedValue("ok");

    expect(await withRetry(operation, { sleep: noSleep })).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("gives up after the attempt budget and rethrows the last error", async () => {
    const operation = vi.fn().mockRejectedValue(new HttpishError("down", 503));

    await expect(
      withRetry(operation, { attempts: 3, sleep: noSleep }),
    ).rejects.toThrow("down");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-retryable error", async () => {
    const operation = vi.fn().mockRejectedValue(new HttpishError("bad", 400));

    await expect(withRetry(operation, { sleep: noSleep })).rejects.toThrow("bad");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("reports each retry so it can be logged", async () => {
    const onRetry = vi.fn();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new HttpishError("x", 500))
      .mockRejectedValueOnce(new HttpishError("x", 500))
      .mockResolvedValue("ok");

    await withRetry(operation, { sleep: noSleep, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0][0].attempt).toBe(1);
    expect(onRetry.mock.calls[1][0].attempt).toBe(2);
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    resetRateLimits();
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 60_000, now).ok).toBe(true);
    }
    const blocked = rateLimit("k", 3, 60_000, now);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("opens a fresh window once the old one expires", () => {
    resetRateLimits();
    const now = 1_000_000;
    rateLimit("k", 1, 1000, now);
    expect(rateLimit("k", 1, 1000, now + 500).ok).toBe(false);
    expect(rateLimit("k", 1, 1000, now + 1500).ok).toBe(true);
  });

  it("keeps callers in separate buckets", () => {
    resetRateLimits();
    const now = 1_000_000;
    rateLimit("a", 1, 60_000, now);
    expect(rateLimit("a", 1, 60_000, now).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000, now).ok).toBe(true);
  });

  it("uses the documented run-creation limit", () => {
    expect(RUN_CREATE_LIMIT).toBeGreaterThan(0);
  });
});

describe("consumeBudget", () => {
  it("throws a RateLimitError once the outbound budget is spent", () => {
    resetRateLimits();
    const budget = { limit: 2, windowMs: 60_000 };

    consumeBudget("github", budget);
    consumeBudget("github", budget);

    expect(() => consumeBudget("github", budget)).toThrow(RateLimitError);
  });

  it("budgets github and model calls separately", () => {
    resetRateLimits();
    const budget = { limit: 1, windowMs: 60_000 };

    consumeBudget("github", budget);
    expect(() => consumeBudget("model", budget)).not.toThrow();
  });
});

describe("clientKey", () => {
  it("takes the first entry of x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18" },
    });
    expect(clientKey(request)).toBe("203.0.113.5");
  });

  it("falls back to a constant rather than to something spoofable", () => {
    expect(clientKey(new Request("https://example.com"))).toBe("unknown");
  });
});
