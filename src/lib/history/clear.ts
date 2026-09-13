import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/env";
import { currentIdentity, identityFilter } from "@/lib/history";

/**
 * Deleting everything one player has played.
 *
 * Every number in the product is derived from `runs` and `answers` -- history,
 * the report aggregate and its insights, XP, level, mastery, the top-bar
 * recent-repository list. So there is exactly one thing to delete, and doing
 * it clears all of them at once. Nothing is stored that would survive.
 *
 * The complication is the snapshot cache. `runs.snapshot_run_id` is
 * `on delete set null`, and the rows a player owns may be the snapshot that
 * OTHER players' runs were built on. Deleting those naively does one of two
 * bad things, both confirmed against the live schema:
 *
 *   - With two or more dependents at the same commit, the delete FAILS
 *     outright. Setting both dependents' `snapshot_run_id` to null makes them
 *     both satisfy `runs_snapshot_cache_key` -- the partial unique index on
 *     (owner, repo, commit_sha) where the snapshot column is null -- and
 *     Postgres raises 23505. The button would simply error for anyone who was
 *     first to ingest a popular repository.
 *   - With exactly one dependent it SUCCEEDS and silently poisons the cache:
 *     that dependent now looks like a reusable snapshot (`ready`/`complete`,
 *     no `snapshot_run_id`) while owning no chunks at all, so the next player
 *     to ask for that repository gets a run with nothing to retrieve from.
 *
 * So a run that other people depend on is stripped rather than dropped: its
 * questions and answers go, and its identity is detached, which removes it
 * from every screen this player can see. What stays is an unowned cache of
 * public GitHub source -- no score, no attempt, nothing personal.
 */

/**
 * Owner of a snapshot nobody can claim.
 *
 * `isUuid()` in `src/lib/identity/cookie.ts` rejects the nil UUID because it
 * requires a version nibble, so no browser can ever present this as its anon
 * id and inherit these rows.
 */
const NOBODY = "00000000-0000-0000-0000-000000000000";

/** Postgres has a parameter ceiling; `in` lists are chunked to stay under it. */
const BATCH = 100;

export type ClearResult = {
  /** Runs removed entirely. */
  deleted: number;
  /** Runs kept as an unowned snapshot because other players build on them. */
  preserved: number;
};

export async function clearHistoryFor(
  anonId: string | null,
  userId: string | null,
): Promise<ClearResult> {
  const filter = identityFilter(anonId, userId);
  if (!filter || !isSupabaseConfigured()) return { deleted: 0, preserved: 0 };

  const supabase = createServiceClient();

  const { data: mine, error: readError } = await supabase
    .from("runs")
    .select("id")
    .or(filter);
  if (readError) throw new Error(`Could not read your runs: ${readError.message}`);

  const myIds = (mine ?? []).map((run) => run.id);
  if (myIds.length === 0) return { deleted: 0, preserved: 0 };

  // Which of my runs are somebody else's foundation? A dependent I also own is
  // going away in this same call, so it does not count.
  const owned = new Set(myIds);
  const dependedOn = new Set<string>();

  for (const batch of chunked(myIds)) {
    const { data } = await supabase
      .from("runs")
      .select("id, snapshot_run_id")
      .in("snapshot_run_id", batch);

    for (const row of data ?? []) {
      if (row.snapshot_run_id && !owned.has(row.id)) dependedOn.add(row.snapshot_run_id);
    }
  }

  const removable = myIds.filter((id) => !dependedOn.has(id));
  const preservable = [...dependedOn];

  // Strip the shared snapshots first. Answers go by run, then questions, then
  // the identity that ties the row to this player.
  for (const batch of chunked(preservable)) {
    await supabase.from("answers").delete().in("run_id", batch);
    await supabase.from("questions").delete().in("run_id", batch);

    const { error } = await supabase
      .from("runs")
      .update({ anon_id: NOBODY, user_id: null, completed_at: null, error: null })
      .in("id", batch);
    if (error) throw new Error(`Could not detach a shared snapshot: ${error.message}`);
  }

  // Everything else goes for real. repo_files, chunks, questions and answers
  // all cascade from the run row.
  let deleted = 0;
  for (const batch of chunked(removable)) {
    const { error } = await supabase.from("runs").delete().in("id", batch);
    if (error) throw new Error(`Could not delete your runs: ${error.message}`);
    deleted += batch.length;
  }

  return { deleted, preserved: preservable.length };
}

function* chunked(ids: string[]): Generator<string[]> {
  for (let i = 0; i < ids.length; i += BATCH) yield ids.slice(i, i + BATCH);
}

/** Clears the caller's own history. The identity never comes from the client. */
export async function clearMyHistory(): Promise<ClearResult> {
  const { anonId, userId } = await currentIdentity();
  return clearHistoryFor(anonId, userId);
}
