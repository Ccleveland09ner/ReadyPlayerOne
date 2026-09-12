import { NextResponse } from "next/server";
import { MissingEnvError } from "@/lib/env";
import { GitHubError } from "@/lib/github";
import { EmbeddingError } from "@/lib/index/embed";
import { GenerationError } from "@/lib/quiz/generate";
import { RateLimitError } from "@/lib/ratelimit";
import { log } from "@/lib/log";

/**
 * Structured error envelopes.
 *
 * Every route answers in one shape, so the client can branch on a stable
 * `code` instead of string-matching prose:
 *
 *   { error: { code, message, retryable, details? } }
 *
 * `message` is written to be shown to a player verbatim -- it names what went
 * wrong and what to do about it. Anything that would leak a stack trace or an
 * internal identifier is logged server-side and replaced with a generic
 * message, because an unexpected failure is not the player's problem to debug.
 */

export type ErrorCode =
  | "bad_request"
  | "not_found"
  | "repo_unavailable"
  | "repo_too_small"
  | "github_rate_limited"
  | "embedding_failed"
  | "generation_failed"
  | "rate_limited"
  | "not_configured"
  | "internal";

export type ApiError = {
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
};

const STATUS_FOR: Record<ErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  repo_unavailable: 404,
  repo_too_small: 422,
  github_rate_limited: 429,
  embedding_failed: 502,
  generation_failed: 422,
  rate_limited: 429,
  not_configured: 500,
  internal: 500,
};

const RETRYABLE: ErrorCode[] = [
  "github_rate_limited",
  "embedding_failed",
  "rate_limited",
  "internal",
];

export function apiError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): NextResponse<ApiError> {
  return NextResponse.json<ApiError>(
    {
      error: {
        code,
        message,
        retryable: RETRYABLE.includes(code),
        ...(details ? { details } : {}),
      },
    },
    { status: STATUS_FOR[code] },
  );
}

/** Maps a thrown error onto the envelope. */
export function errorResponse(
  error: unknown,
  context: { runId?: string } = {},
): NextResponse<ApiError> {
  if (error instanceof MissingEnvError) {
    // Configuration is the operator's problem, so the real message helps.
    log.error("run.fail", { ...context, kind: "not_configured" });
    return apiError("not_configured", error.message);
  }

  if (error instanceof RateLimitError) {
    return apiError("rate_limited", error.message, { retryAfterMs: error.retryAfterMs });
  }

  if (error instanceof GitHubError) {
    const code: ErrorCode =
      error.status === 429 ? "github_rate_limited" : "repo_unavailable";
    log.warn("run.fail", { ...context, kind: code, status: error.status });
    return apiError(code, error.message);
  }

  if (error instanceof EmbeddingError) {
    log.error("run.fail", { ...context, kind: "embedding_failed", error: error.message });
    return apiError(
      "embedding_failed",
      "The embedding service could not be reached. Try this repository again in a moment.",
    );
  }

  if (error instanceof GenerationError) {
    log.error("run.fail", { ...context, kind: "generation_failed", error: error.message });
    return apiError("generation_failed", error.message);
  }

  const message = error instanceof Error ? error.message : String(error);
  log.error("run.fail", { ...context, kind: "internal", error: message });
  return apiError(
    "internal",
    "Something went wrong on our side. Try again in a moment.",
  );
}
