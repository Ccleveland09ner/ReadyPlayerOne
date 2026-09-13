/**
 * Reading the API error envelope from the browser.
 *
 * Every route answers failures as `{ error: { code, message, retryable } }`
 * (see `src/lib/api.ts`). Client components used to read `payload.error`
 * directly and hand the result to `setError`, which put an *object* into React
 * state -- and rendering an object as a child throws, so a mistyped repository
 * URL took the whole screen down instead of showing "Could not find that repo".
 *
 * This is the one place that knows the shape. It is deliberately total: any
 * payload at all, including a proxy's HTML error page parsed into nothing,
 * comes back as a string worth showing someone.
 */

export type ApiErrorBody = {
  error?: { code?: string; message?: string; retryable?: boolean } | string;
};

/** The message to show a player, or `fallback` when the body carries none. */
export function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;

  const { error } = payload as ApiErrorBody;

  // A bare string is not a shape this API produces, but it costs one branch to
  // survive a proxy or a future route that answers that way.
  if (typeof error === "string") return error || fallback;

  if (error && typeof error === "object" && typeof error.message === "string") {
    return error.message || fallback;
  }

  return fallback;
}

/** The stable `code`, for branching on a failure rather than matching prose. */
export function errorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const { error } = payload as ApiErrorBody;
  if (error && typeof error === "object" && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

/** POSTs JSON and throws the envelope's message on failure. */
export async function postJson<T>(path: string, body: unknown = {}): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      errorMessage(payload, `Request failed (${response.status}).`),
    );
  }

  return payload as T;
}
