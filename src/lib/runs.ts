import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/env";
import type { RunStatus } from "@/lib/types";

/** The run row as the pipeline reads it. */
export type RunRecord = {
  id: string;
  owner: string;
  repo: string;
  commit_sha: string;
  default_branch: string | null;
  snapshot_run_id: string | null;
  status: RunStatus;
  question_count: number;
  hearts_remaining: number;
  completed_at: string | null;
  stage_detail: Record<string, unknown>;
  error: string | null;
  anon_id: string;
  user_id: string | null;
  created_at: string;
};

export async function loadRun(runId: string): Promise<RunRecord | null> {
  // No database configured means no runs exist; the page renders not-found
  // rather than crashing. Routes that WRITE still throw MissingEnvError.
  if (!isSupabaseConfigured()) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  return (data as RunRecord | null) ?? null;
}

export async function updateRun(
  runId: string,
  patch: Partial<{
    status: RunStatus;
    stage_detail: Record<string, unknown>;
    error: string | null;
    hearts_remaining: number;
    completed_at: string | null;
  }>,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("runs").update(patch).eq("id", runId);
  if (error) throw new Error(`Could not update run: ${error.message}`);
}

/** Marks the run failed with a message the UI can show verbatim. */
export async function failRun(runId: string, message: string): Promise<void> {
  await updateRun(runId, { status: "failed", error: message });
}

/**
 * A cached or retaken run points at another run's chunks and manifest.
 * Never query `chunks` or `repo_files` by `run.id`.
 */
export function snapshotIdOf(run: RunRecord): string {
  return run.snapshot_run_id ?? run.id;
}
