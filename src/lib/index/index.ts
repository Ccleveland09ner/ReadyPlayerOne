/**
 * Chunking, embedding and retrieval.
 *
 * Not implemented yet (Feature 2). Chunk sizes come from the tech design:
 * files under 40 lines become one chunk, everything else is a 60-line window
 * with 10-line overlap, and line numbers are 1-based and exact.
 */

export const CHUNK_WINDOW_LINES = 60;
export const CHUNK_OVERLAP_LINES = 10;
export const WHOLE_FILE_UNDER_LINES = 40;
export const RETRIEVAL_TOP_K = 6;

/**
 * A cached or retaken run points at another run chunks, so every query
 * against chunks and repo_files must resolve through here — never run.id.
 * Getting this wrong means cached runs retrieve nothing and generation
 * silently degrades.
 */
export function effectiveSnapshotId(run: {
  id: string;
  snapshotRunId: string | null;
}): string {
  return run.snapshotRunId ?? run.id;
}
