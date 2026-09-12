/**
 * Structured logging for the pipeline.
 *
 * One line of JSON per event, so Vercel's log view can be filtered by `runId`
 * or `event` instead of read as prose. Timings are the point: the
 * non-functional target is 90 seconds of ingestion and 20 of generation, and
 * you cannot tell whether you are hitting it without per-stage numbers.
 *
 * Never log secrets, and never log repository file contents -- both would end
 * up in a log drain that outlives the run.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type PipelineEvent =
  | "run.create"
  | "run.cached"
  | "run.fail"
  | "ingest.tree"
  | "ingest.batch"
  | "ingest.file_skip"
  | "ingest.done"
  | "embed.retry"
  | "embed.batch"
  | "generate.retrieve"
  | "generate.call"
  | "generate.verify"
  | "generate.reject"
  | "generate.done"
  | "answer.score"
  | "ratelimit.block";

type Fields = Record<string, string | number | boolean | null | undefined>;

function emit(level: LogLevel, event: PipelineEvent, fields: Fields) {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...fields,
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: PipelineEvent, fields: Fields = {}) => emit("info", event, fields),
  warn: (event: PipelineEvent, fields: Fields = {}) => emit("warn", event, fields),
  error: (event: PipelineEvent, fields: Fields = {}) => emit("error", event, fields),
};

/**
 * Times an operation and logs it, whether it succeeds or throws.
 *
 * The failure path matters more than the success path here: a run that dies at
 * hour 19 needs to say which stage it died in and how long it had been trying.
 */
export async function timed<T>(
  event: PipelineEvent,
  fields: Fields,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await operation();
    log.info(event, { ...fields, ms: Date.now() - startedAt, ok: true });
    return result;
  } catch (error) {
    log.error(event, {
      ...fields,
      ms: Date.now() - startedAt,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
