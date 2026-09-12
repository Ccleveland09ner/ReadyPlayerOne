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
 * length: 60 lines of a markdown table or a link-dense list can run far past
 * the embedding model's 8192-token limit, and the provider rejects the whole
 * batch with a 400 -- killing the run, not just that chunk.
 * sindresorhus/awesome does exactly this.
 *
 * The "~4 characters per token" rule of thumb is for English prose and is
 * badly wrong here: awesome-list markdown is mostly URLs, and a URL tokenizes
 * closer to 1.5 characters per token. 24k characters looked safe by that rule
 * and still produced 8192+ token inputs in practice. 12k is the conservative
 * figure, and `shrinkToFit` below is the belt to its braces -- guessing a
 * constant is exactly how this bug happened the first time.
 *
 * Only the string we EMBED is truncated. The chunk's stored content and its
 * line range stay exact, so citations are unaffected, and the tail of an
 * oversized chunk contributes almost nothing to a similarity search anyway.
 */
export const MAX_EMBED_INPUT_CHARS = 12_000;

export function truncateForEmbedding(text: string): string {
  return text.length > MAX_EMBED_INPUT_CHARS
    ? text.slice(0, MAX_EMBED_INPUT_CHARS)
    : text;
}

/** Does this 400 mean "your input was too long" rather than "your request was wrong"? */
export function isInputTooLong(detail: string): boolean {
  return /maximum (input |context )?length|too many tokens|reduce the length/i.test(
    detail,
  );
}

/** Internal: a 400 that says the input was too long, which shrinking can fix. */
class InputTooLongError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputTooLongError";
  }
}

/** Embedding providers rate-limit aggressively; three attempts is the floor. */
const EMBED_ATTEMPTS = 3;

/** How many times to halve the inputs before giving up. */
const SHRINK_ATTEMPTS = 4;

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
    // ...except "your input was too long", which is a 400 that CAN improve:
    // the same inputs, shorter, will succeed. Signalled distinctly so
    // embedBatch can shrink and try again rather than killing the run.
    if (response.status === 400 && isInputTooLong(detail)) {
      throw new InputTooLongError(message);
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

/**
 * Embeds a batch, shrinking the inputs if the provider says they are too long.
 *
 * A character cap can only ever be a guess: tokens-per-character swings from
 * ~4 for English prose to ~1.5 for URL-dense markdown, and that guess being
 * wrong took down three runs. So the cap is the first line of defence and this
 * is the second -- halve and retry until the provider accepts it. Self-
 * correcting beats a constant tuned against one corpus.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  let limit = MAX_EMBED_INPUT_CHARS;

  for (let shrink = 0; shrink < SHRINK_ATTEMPTS; shrink++) {
    const sized = texts.map((text) =>
      text.length > limit ? text.slice(0, limit) : text,
    );
    try {
      return await embedWithRetry(sized);
    } catch (error) {
      if (!(error instanceof InputTooLongError) || shrink === SHRINK_ATTEMPTS - 1) {
        throw error instanceof InputTooLongError
          ? new EmbeddingError(error.message, 400)
          : error;
      }
      limit = Math.floor(limit / 2);
      log.warn("embed.retry", {
        reason: "input_too_long",
        newLimitChars: limit,
        inputs: texts.length,
      });
    }
  }

  throw new EmbeddingError("Could not shrink embedding inputs enough.", 400);
}

async function embedWithRetry(texts: string[]): Promise<number[][]> {
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

    // Must reach embedBatch intact so it can shrink and try again -- collapsing
    // it here would turn a recoverable situation into a dead run.
    if (error instanceof InputTooLongError) throw error;

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
