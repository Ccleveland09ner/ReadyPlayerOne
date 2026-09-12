import "server-only";

/**
 * Server-side environment access.
 *
 * Every value here is read at call time, not at module load, so an unset key
 * fails the request that needed it with a message naming the key -- rather
 * than crashing the whole server at boot or, worse, silently sending
 * `undefined` to a provider and getting back an opaque 401.
 *
 * Nothing in this file may be imported from a client component: the service
 * role key and the model keys are server-only secrets.
 */

export class MissingEnvError extends Error {
  constructor(key: string) {
    super(
      `Missing required environment variable ${key}. Copy .env.example to .env.local and fill it in.`,
    );
    this.name = "MissingEnvError";
  }
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new MissingEnvError(key);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),

  /** Optional. Raises the GitHub rate limit substantially when present. */
  githubToken: () => process.env.GITHUB_TOKEN || null,

  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  anthropicModel: () => optional("ANTHROPIC_MODEL", "claude-opus-5"),

  embeddingApiKey: () => required("EMBEDDING_API_KEY"),
  embeddingBaseUrl: () =>
    optional("EMBEDDING_BASE_URL", "https://api.openai.com/v1"),
  embeddingModel: () => optional("EMBEDDING_MODEL", "text-embedding-3-small"),
};

/**
 * Whether Supabase credentials exist at all.
 *
 * Read-only screens call this and render their empty state when it is false,
 * so the UI still works on a fresh clone. The pipeline routes deliberately do
 * NOT: they cannot do their job without a database, and failing loudly with
 * the name of the missing key is more useful than an empty quiz.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Dimension of the `chunks.embedding` column. The default embedding model
 * produces exactly this many; swapping model or provider means changing the
 * column type in a migration too, so the value is asserted at embed time
 * rather than trusted.
 */
export const EMBEDDING_DIMENSIONS = 1536;
