import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Clear Quiz History, against the real schema.
 *
 * Not in the default suite -- `npm test` stays offline and free. Run with
 * `npm run test:live`.
 *
 * This one has to be live. The behaviour worth proving is a database
 * behaviour: `runs.snapshot_run_id` is `on delete set null`, and that
 * interacts with `runs_snapshot_cache_key` in a way no mock would reproduce.
 * A plain `delete from runs where user_id = me` fails outright with 23505 as
 * soon as two other players' runs share a commit off one of your snapshots,
 * and silently poisons the cache when only one does. Both are asserted below.
 *
 * Free: rows are written directly, no model or embedding calls.
 */

const env = Object.fromEntries(
  readFileSync(new URL("../../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
) as Record<string, string>;

process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const mine = crypto.randomUUID();
const theirs = crypto.randomUUID();
const created: string[] = [];

/** A run owned by `anonId`, optionally built on someone else's snapshot. */
async function makeRun(
  anonId: string,
  commitSha: string,
  snapshotRunId: string | null = null,
): Promise<string> {
  const { data, error } = await db
    .from("runs")
    .insert({
      owner: "cleartest",
      repo: "fixture",
      commit_sha: commitSha,
      anon_id: anonId,
      status: "complete",
      completed_at: new Date().toISOString(),
      snapshot_run_id: snapshotRunId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  created.push(data.id);

  if (!snapshotRunId) {
    const { error: fileError } = await db
      .from("repo_files")
      .insert({ run_id: data.id, path: "index.ts", byte_size: 64, included: true });
    if (fileError) throw new Error(`repo_files: ${fileError.message}`);
  }

  const { data: question, error: questionError } = await db
    .from("questions")
    .insert({
      run_id: data.id,
      order_index: 0,
      topic: "core_logic",
      prompt: "What does it do?",
      options: ["A", "B", "C", "D"].map((label, i) => ({
        label,
        text: `Option ${label}`,
        explanation: "Because.",
        citation: i === 0 ? { path: "index.ts", startLine: 1, endLine: 5 } : null,
        verified: i === 0,
      })),
      correct_index: 0,
    })
    .select("id")
    .single();
  if (questionError) throw new Error(`questions: ${questionError.message}`);

  const { error: answerError } = await db.from("answers").insert({
    run_id: data.id,
    question_id: question!.id,
    selected_index: 0,
    is_correct: true,
    streak_at_answer: 1,
  });
  if (answerError) throw new Error(`answers: ${answerError.message}`);

  return data.id;
}

const countRuns = async (anonId: string) =>
  (await db.from("runs").select("id", { count: "exact", head: true }).eq("anon_id", anonId))
    .count ?? 0;

const countAnswers = async (runId: string) =>
  (await db.from("answers").select("id", { count: "exact", head: true }).eq("run_id", runId))
    .count ?? 0;

const countFiles = async (runId: string) =>
  (await db.from("repo_files").select("id", { count: "exact", head: true }).eq("run_id", runId))
    .count ?? 0;

let clearHistoryFor: typeof import("@/lib/history/clear").clearHistoryFor;

// A snapshot of mine that two of THEIR runs are built on -- the shape that
// makes a naive delete fail with 23505 -- plus two plain runs of my own.
let sharedSnapshot: string;
let plainRuns: string[];

beforeAll(async () => {
  ({ clearHistoryFor } = await import("@/lib/history/clear"));

  sharedSnapshot = await makeRun(mine, "a".repeat(40));
  await makeRun(theirs, "a".repeat(40), sharedSnapshot);
  await makeRun(theirs, "a".repeat(40), sharedSnapshot);

  plainRuns = [
    await makeRun(mine, "b".repeat(40)),
    await makeRun(mine, "c".repeat(40)),
  ];
});

afterAll(async () => {
  // Detached snapshots no longer carry my anon id, so delete by id.
  await db.from("runs").delete().in("id", created);
});

describe("clearHistoryFor", () => {
  it("clears an identity that has nothing without touching anything", async () => {
    const result = await clearHistoryFor(crypto.randomUUID(), null);
    expect(result).toEqual({ deleted: 0, preserved: 0 });
  });

  it("does nothing when there is no identity at all", async () => {
    expect(await clearHistoryFor(null, null)).toEqual({ deleted: 0, preserved: 0 });
  });

  it("deletes every run the player owns and keeps the shared snapshot", async () => {
    const result = await clearHistoryFor(mine, null);

    expect(result.deleted).toBe(plainRuns.length);
    expect(result.preserved).toBe(1);
  });

  it("leaves the player with no runs at all", async () => {
    expect(await countRuns(mine)).toBe(0);
  });

  it("removes the answers every report and XP total is derived from", async () => {
    for (const runId of [...plainRuns, sharedSnapshot]) {
      expect(await countAnswers(runId)).toBe(0);
    }
  });

  it("strips the shared snapshot of the player's score and identity", async () => {
    const { data } = await db
      .from("runs")
      .select("anon_id, user_id, completed_at")
      .eq("id", sharedSnapshot)
      .single();

    expect(data!.anon_id).toBe("00000000-0000-0000-0000-000000000000");
    expect(data!.user_id).toBeNull();
    expect(data!.completed_at).toBeNull();
  });

  it("keeps the shared snapshot's chunks, so other players' runs still resolve", async () => {
    // The poisoning case: had this been deleted, `snapshot_run_id` would be
    // nulled on their runs and they would resolve to themselves -- a cache
    // entry advertising a repository it holds no source for.
    expect(await countFiles(sharedSnapshot)).toBeGreaterThan(0);

    const { data } = await db
      .from("runs")
      .select("id, snapshot_run_id")
      .eq("anon_id", theirs);

    expect(data).toHaveLength(2);
    for (const run of data!) expect(run.snapshot_run_id).toBe(sharedSnapshot);
  });

  it("leaves the other player's quizzes and answers untouched", async () => {
    const { data } = await db.from("runs").select("id").eq("anon_id", theirs);
    for (const run of data!) expect(await countAnswers(run.id)).toBe(1);
  });

  it("is safe to run twice", async () => {
    expect(await clearHistoryFor(mine, null)).toEqual({ deleted: 0, preserved: 0 });
  });
});
