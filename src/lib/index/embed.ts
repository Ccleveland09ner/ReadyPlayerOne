import "server-only";
import { EMBEDDING_DIMENSIONS, MissingEnvError, env } from "@/lib/env";
import { HttpishError, isRetryableStatus, withRetry } from "@/lib/retry";
import { log } from "@/lib/log";

/**
 * Embeddings.
 *
 * Anthropic does not serve an embeddings endpoint, so this is the one place
 * the pipeline talks to a second provider. It speaks the OpenAI `/embeddings`
 * shape, which most hosted embedding providers implement -- point
 * EMBEDDING_BASE_URL elsewhere to swap without touching this code.
 *
 * The returned dimension is asserted rather than trusted: a model that returns
 * something other than 1536 would otherwise fail deep inside a Postgres insert
 * with a message that says nothing about the cause.
 */

export class EmbeddingError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

/** Hard ceiling per run, so a pathological repo cannot drain credits. */
export const MAX_EMBEDDING_CALLS_PER_RUN = 40;

/**
 * Character ceiling per input.
 *
 * The chunker bounds chunks by LINE COUNT, which says nothing about line
 * length: 60 lines of a markdown table or a minified-ish data blob can run far
 * past the embedding model's 8192-token limit, and the provider rejects the
 * whole batch with a 400 -- killing the run, not just that chunk.
 * sindresorhus/awesome does exactly this.
 *
 * ~4 characters per token is the usual English rule of thumb; 24k characters
 * leaves real headroom under 8192 tokens for code and CJK text, which tokenize
 * worse. Only the string we EMBED is truncated -- the chunk's stored content
 * and its line range stay exact, so citations are unaffected. The tail of an
 * oversized chunk contributes nothing to retrieval anyway.
 */
export const MAX_EMBED_INPUT_CHARS = 24_000;

export function truncateForEmbedding(text: string): string {
  return text.length > MAX_EMBED_INPUT_CHARS
    ? text.slice(0, MAX_EMBED_INPUT_CHARS)
    : text;
}

/** Embedding providers rate-limit aggressively; three attempts is the floor. */
const EMBED_ATTEMPTS = 3;

async function embedOnce(texts: string[]): Promise<number[][]> {
  // Read configuration OUTSIDE the try. Inside it, a missing key would be
  // caught below and reported as "could not reach the provider" -- sending
  // someone to debug their network when the fix is one line of .env.local --
  // and it would burn the whole retry budget on an error that cannot improve.
  const baseUrl = env.embeddingBaseUrl();
  const apiKey = env.embeddingApiKey();
  const model = env.embeddingModel();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: texts.map(truncateForEmbedding) }),
      cache: "no-store",
    });
  } catch (cause) {
    // A network failure is worth retrying; surface it as such.
    throw new HttpishError(
      `Could not reach the embedding provider: ${cause instanceof Error ? cause.message : String(cause)}`,
      503,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const message = `Embedding request failed (${response.status}). ${detail.slice(0, 200)}`;
    // Retryable statuses go back as HttpishError so withRetry picks them up;
    // a 400 is a bad request that will be bad again, so it fails now.
    if (isRetryableStatus(response.status)) {
      throw new HttpishError(message, response.status);
    }
    throw new EmbeddingError(message, response.status);
  }

  const payload = (await response.json()) as {
    data?: { embedding: number[]; index: number }[];
  };

  if (!payload.data || payload.data.length !== texts.length) {
    throw new EmbeddingError(
      `Embedding provider returned ${payload.data?.length ?? 0} vectors for ${texts.length} inputs.`,
    );
  }

  // Providers are permitted to return these out of order.
  const ordered = [...payload.data].sort((a, b) => a.index - b.index);

  for (const item of ordered) {
    if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new EmbeddingError(
        `Embedding model returned ${item.embedding.length} dimensions; the chunks table expects ${EMBEDDING_DIMENSIONS}. Change the model or migrate the column.`,
      );
    }
  }

  return ordered.map((item) => item.embedding);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
    return await withRetry(() => embedOnce(texts), {
      attempts: EMBED_ATTEMPTS,
      baseDelayMs: 500,
      maxDelayMs: 6000,
      onRetry: ({ attempt, delayMs, error }) =>
        log.warn("embed.retry", {
          attempt,
          delayMs,
          inputs: texts.length,
          error: error instanceof Error ? error.message : String(error),
        }),
    });
  } catch (error) {
    // A missing key is a configuration problem, not a transport one. Collapsing
    // it into "could not be reached" sends people to debug their network when
    // the answer is one line of .env.local.
    if (error instanceof MissingEnvError) throw error;

    // Collapse the transport error into the domain error the routes map on.
    if (error instanceof EmbeddingError) throw error;
    throw new EmbeddingError(
      error instanceof Error ? error.message : String(error),
      error instanceof HttpishError ? error.status : undefined,
    );
  }
}

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text]);
  return vector;
}
