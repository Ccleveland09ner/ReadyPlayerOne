import "server-only";
import { EMBEDDING_DIMENSIONS, env } from "@/lib/env";

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
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingError";
  }
}

/** Hard ceiling per run, so a pathological repo cannot drain credits. */
export const MAX_EMBEDDING_CALLS_PER_RUN = 40;

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await fetch(`${env.embeddingBaseUrl()}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.embeddingApiKey()}`,
    },
    body: JSON.stringify({
      model: env.embeddingModel(),
      input: texts,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new EmbeddingError(
      `Embedding request failed (${response.status}). ${detail.slice(0, 200)}`,
    );
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

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text]);
  return vector;
}
