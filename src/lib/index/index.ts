import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { embedOne } from "@/lib/index/embed";

export {
  chunkFile,
  countLines,
  splitLines,
  CHUNK_OVERLAP_LINES,
  CHUNK_WINDOW_LINES,
  WHOLE_FILE_UNDER_LINES,
  type SourceChunk,
} from "@/lib/index/chunk";

export const RETRIEVAL_TOP_K = 6;

export type RetrievedChunk = {
  id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  content: string;
  language: string | null;
  similarity: number;
};

/**
 * A cached or retaken run points at another run's chunks, so every query
 * against `chunks` and `repo_files` must resolve through here -- never
 * `run.id` directly.
 *
 * Getting this wrong means cached runs retrieve nothing and generation
 * silently degrades into generic questions, which is an ugly bug to find at
 * hour 19.
 */
export function effectiveSnapshotId(run: {
  id: string;
  snapshot_run_id: string | null;
}): string {
  return run.snapshot_run_id ?? run.id;
}

/** Cosine nearest neighbours inside one run's partition. */
export async function retrieve(
  snapshotId: string,
  query: string,
  topK: number = RETRIEVAL_TOP_K,
): Promise<RetrievedChunk[]> {
  const embedding = await embedOne(query);
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    p_run_id: snapshotId,
    p_embedding: JSON.stringify(embedding),
    p_match_count: topK,
  });

  if (error) throw new Error(`Retrieval failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}
