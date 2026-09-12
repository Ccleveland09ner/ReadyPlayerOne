/**
 * Retry with exponential backoff and full jitter.
 *
 * Pure except for the clock, so the policy is testable without waiting: pass a
 * `sleep` to control timing in tests.
 *
 * Only retries what is worth retrying. A 400 from a provider means the request
 * was wrong and will be wrong again; a 429 or a 503 means try later. Retrying
 * the first class burns the budget that would have rescued the second.
 */

export type RetryableCheck = (error: unknown) => boolean;

export type RetryOptions = {
  attempts?: number;
  /** Delay before the first retry, in ms. Doubles each attempt. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: RetryableCheck;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** An error carrying an HTTP status, so the policy can read it. */
export class HttpishError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpishError";
  }
}

/** 408, 409, 429 and 5xx are worth another go; everything else is not. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof HttpishError) return isRetryableStatus(error.status);

  // Undici/fetch network failures surface as TypeError with a cause.
  if (error instanceof TypeError) return true;

  const status = (error as { status?: unknown })?.status;
  if (typeof status === "number") return isRetryableStatus(status);

  return false;
}

/**
 * Full jitter: `random() * min(max, base * 2^n)`.
 *
 * Not exponential-plus-fixed-jitter -- when several batches fail at the same
 * moment, undiluted exponential backoff retries them all at the same moment
 * too, and the thundering herd re-triggers the rate limit that caused it.
 */
export function backoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.round(random() * ceiling);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 400,
    maxDelayMs = 8000,
    isRetryable = defaultIsRetryable,
    onRetry,
    sleep = defaultSleep,
    random = Math.random,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const exhausted = attempt >= attempts;
      if (exhausted || !isRetryable(error)) throw error;

      const delayMs = backoffDelay(attempt, baseDelayMs, maxDelayMs, random);
      onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw lastError;
}
