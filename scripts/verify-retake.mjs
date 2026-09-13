/**
 * Try Again verification.
 *
 *   node scripts/verify-retake.mjs http://localhost:3000
 *
 * The bug this exists for: Try Again on the results screen linked to
 * `/runs/:id/start` for the run you had just finished, and `/runs/:id`
 * redirects a run with a `completed_at` straight back to `/complete`. Results,
 * confirm, results -- a closed loop, with no way to retake a repository at all.
 *
 * A retake has to be a NEW run pointing `snapshot_run_id` at the finished one:
 * same commit, same chunks, freshly generated questions. These checks assert
 * exactly that, and that the finished run is left alone so history keeps it.
 *
 * Free. It works at the repository's real HEAD so the create route takes its
 * cache path, and the cache path neither embeds nor generates. It reuses a
 * finished snapshot if the project already holds one and seeds a throwaway
 * otherwise; only rows it created itself are deleted on the way out.
 *
 * Pass a different repository as the second argument if the default already
 * has an unfinished snapshot at its current HEAD.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const [repoOwner, repoName] = (process.argv[3] ?? "sindresorhus/p-map").split("/");
const REPO = { owner: repoOwner, repo: repoName };

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (ok) passed++;
  else failed++;
};

const anonId = crypto.randomUUID();
const cookie = `rpo_aid=${anonId}; rpo_seen=1`;
const runIds = [];

const TOPICS = ["file_structure", "core_logic", "apis", "testing", "deployment"];
const OPTIONS = (correct) =>
  ["A", "B", "C", "D"].map((label, i) => ({
    label,
    text: `Option ${label}`,
    explanation: `Why ${label} is ${i === correct ? "right" : "wrong"}.`,
    citation: i === correct ? { path: "index.js", startLine: 1, endLine: 20 } : null,
    verified: i === correct,
  }));

/** The repository's real HEAD, so POST /api/runs finds the seeded snapshot. */
async function headSha() {
  const headers = { Accept: "application/vnd.github+json" };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const meta = await fetch(
    `https://api.github.com/repos/${REPO.owner}/${REPO.repo}`,
    { headers },
  ).then((r) => r.json());
  const branch = await fetch(
    `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/branches/${meta.default_branch}`,
    { headers },
  ).then((r) => r.json());
  return { sha: branch.commit.sha, branch: meta.default_branch };
}

/**
 * A finished run at that commit: the thing a player is looking at.
 *
 * Reuses one if the project already holds a completed snapshot of this commit.
 * It must -- `runs_snapshot_cache_key` is a partial unique index that refuses a
 * second ready-or-complete snapshot of the same commit, so seeding
 * unconditionally fails the moment someone has actually played this repository.
 * A reused run is left in place on the way out; only seeded rows are deleted.
 */
async function finishedRunAt(sha, branch) {
  const { data: existing } = await db
    .from("runs")
    .select("id, status, completed_at")
    .match({ owner: REPO.owner, repo: REPO.repo, commit_sha: sha })
    .is("snapshot_run_id", null)
    .in("status", ["ready", "complete"])
    .limit(1)
    .maybeSingle();

  if (!existing) return { id: await seedFinishedRun(sha, branch), seeded: true };

  if (!existing.completed_at) {
    throw new Error(
      `${REPO.owner}/${REPO.repo} already has an unfinished snapshot at this ` +
        `commit, and the cache-key index forbids seeding a second one. ` +
        `Re-run with a repository nobody has started: ` +
        `node scripts/verify-retake.mjs ${baseUrl} owner/repo`,
    );
  }

  return { id: existing.id, seeded: false };
}

async function seedFinishedRun(sha, branch) {
  const { data: run, error } = await db
    .from("runs")
    .insert({
      ...REPO,
      commit_sha: sha,
      default_branch: branch,
      anon_id: anonId,
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`seed run: ${error.message}`);
  runIds.push(run.id);

  const { error: fileError } = await db
    .from("repo_files")
    .insert({ run_id: run.id, path: "index.js", byte_size: 512, included: true });
  if (fileError) throw new Error(`seed repo_files: ${fileError.message}`);

  for (let q = 0; q < 5; q++) {
    const { data: question } = await db
      .from("questions")
      .insert({
        run_id: run.id,
        order_index: q,
        topic: TOPICS[q],
        prompt: `Seeded question ${q + 1}?`,
        options: OPTIONS(0),
        correct_index: 0,
      })
      .select("id")
      .single();

    await db.from("answers").insert({
      run_id: run.id,
      question_id: question.id,
      selected_index: 0,
      is_correct: true,
      streak_at_answer: q + 1,
    });
  }

  return run.id;
}

async function main() {
  console.log(`\nTry Again  ${baseUrl}  ${REPO.owner}/${REPO.repo}\n`);

  const { sha, branch } = await headSha();
  const { id: finishedId, seeded } = await finishedRunAt(sha, branch);
  check(
    `${seeded ? "seeded" : "reused"} a finished run at the live HEAD`,
    Boolean(finishedId),
    sha.slice(0, 7),
  );

  // Whatever that run's answers are, the retake must not disturb them.
  const { count: answersBefore } = await db
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("run_id", finishedId);

  // --- the results screen ---------------------------------------------------
  const complete = await fetch(`${baseUrl}/runs/${finishedId}/complete`, {
    headers: { cookie },
  });
  const html = await complete.text();
  check("results screen renders", complete.status === 200, `status ${complete.status}`);

  check(
    "Try Again is no longer a link back to this run's own confirm screen",
    !html.includes(`/runs/${finishedId}/start`),
  );
  check("results screen still offers Try Again", html.includes("TRY AGAIN"));

  // The loop the bug rode on. Still true, which is why Try Again must not
  // point here: a finished run's URL is a record, not a game.
  const revisit = await fetch(`${baseUrl}/runs/${finishedId}`, {
    headers: { cookie },
    redirect: "manual",
  });
  check(
    "a finished run still redirects to its results (the loop Try Again used to close)",
    revisit.status >= 300 && revisit.status < 400,
    `${revisit.status} -> ${revisit.headers.get("location") ?? "?"}`,
  );

  // --- what Try Again actually does now -------------------------------------
  const started = await fetch(`${baseUrl}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ repoUrl: `${REPO.owner}/${REPO.repo}` }),
  });
  const payload = await started.json().catch(() => ({}));
  check(
    "Try Again creates a run",
    started.ok && typeof payload.runId === "string",
    started.ok ? "" : JSON.stringify(payload).slice(0, 160),
  );
  if (!payload.runId) return finish();
  runIds.push(payload.runId);

  check("the retake is a different run", payload.runId !== finishedId);
  check("it reports the snapshot was reused", payload.cached === true);

  const { data: retake } = await db
    .from("runs")
    .select("id, commit_sha, snapshot_run_id, status, completed_at")
    .eq("id", payload.runId)
    .single();

  check(
    "it reuses the finished run's snapshot rather than re-ingesting",
    retake.snapshot_run_id === finishedId,
  );
  check("it is pinned to the same commit", retake.commit_sha === sha);
  check("it is playable, not already complete", retake.completed_at === null);

  const { count: carried } = await db
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("run_id", payload.runId);
  check("no answers carry over from the finished run", carried === 0, `${carried}`);

  const { count: kept } = await db
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("run_id", finishedId);
  check(
    "the finished run keeps its answers for history",
    kept === answersBefore,
    `${kept} of ${answersBefore}`,
  );

  // Where Try Again sends the player: the run screen, which generates the new
  // questions and moves on. It must NOT bounce to results the way the old one did.
  const landing = await fetch(`${baseUrl}/runs/${payload.runId}`, {
    headers: { cookie },
    redirect: "manual",
  });
  check(
    "the retake's run screen does not bounce to results",
    landing.status === 200,
    `status ${landing.status}`,
  );

  return finish();
}

async function finish() {
  await db.from("runs").delete().in("id", runIds);
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  if (runIds.length) await db.from("runs").delete().in("id", runIds);
  console.error(error);
  process.exit(1);
});
