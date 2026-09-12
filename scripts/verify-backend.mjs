/**
 * Live backend verification.
 *
 *   node scripts/verify-backend.mjs
 *
 * Reads .env.local and checks the deployed schema behaves the way the pipeline
 * assumes. Every check runs against the real project over PostgREST -- the
 * same path the app uses -- so it catches the things a migration file cannot
 * prove on its own: that RLS actually denies, that the cache key actually
 * collides, that match_chunks actually orders by distance.
 *
 * Writes only to rows it creates, and deletes them on the way out.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- env --------------------------------------------------------------------

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing Supabase values in .env.local.");
  process.exit(1);
}

const service = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

// --- harness ----------------------------------------------------------------

let passed = 0;
let failed = 0;
const cleanup = [];

async function check(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const uuid = () => crypto.randomUUID();
const SHA = "a".repeat(40);

async function makeRun(overrides = {}) {
  const { data, error } = await service
    .from("runs")
    .insert({
      owner: "verify",
      repo: `repo-${Math.random().toString(36).slice(2, 8)}`,
      commit_sha: SHA,
      anon_id: uuid(),
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  cleanup.push(data.id);
  return data.id;
}

// --- checks -----------------------------------------------------------------

console.log(`\nVerifying ${url}\n`);

console.log("Schema reachable");
await check("all six tables respond", async () => {
  for (const table of [
    "runs",
    "repo_files",
    "chunks",
    "questions",
    "answers",
    "profiles",
  ]) {
    const { error } = await service.from(table).select("*").limit(0);
    assert(!error, `${table}: ${error?.message}`);
  }
});

await check("verified_citations view responds", async () => {
  const { error } = await service.from("verified_citations").select("*").limit(0);
  assert(!error, error?.message);
});

await check("todos table is gone", async () => {
  const { error } = await service.from("todos").select("*").limit(0);
  assert(error, "todos still exists; its permissive policies must not ship");
});

console.log("\nRow Level Security");
await check("anon cannot read chunks (they hold full source text)", async () => {
  // RLS with no policy denies by returning zero rows, not by erroring -- so
  // assert on what came back, not on whether PostgREST complained.
  const runId = await makeRun();
  const { error: seedError } = await service.from("chunks").insert({
    run_id: runId,
    file_path: "secret.ts",
    start_line: 1,
    end_line: 2,
    content: "source text that must not leave the server",
  });
  assert(!seedError, seedError?.message);

  const { data, error } = await anon.from("chunks").select("file_path, content");
  assert(!error || data === null, `unexpected shape: ${error?.message}`);
  assert(
    !data || data.length === 0,
    `anon read ${data?.length} chunk rows: ${JSON.stringify(data)?.slice(0, 120)}`,
  );
});

await check("anon cannot insert a run", async () => {
  const { error } = await anon
    .from("runs")
    .insert({ owner: "x", repo: "y", commit_sha: SHA, anon_id: uuid() });
  assert(error, "anon was able to insert into runs");
});

await check("anon cannot insert an answer", async () => {
  const { error } = await anon
    .from("answers")
    .insert({ run_id: uuid(), question_id: uuid(), is_correct: true });
  assert(error, "anon was able to insert into answers");
});

await check("anon cannot update a run", async () => {
  const runId = await makeRun();
  const { data, error } = await anon
    .from("runs")
    .update({ hearts_remaining: 99 })
    .eq("id", runId)
    .select("id");
  // RLS with no UPDATE policy returns no rows rather than an error.
  assert(error || !data || data.length === 0, "anon was able to update a run");

  const { data: after } = await service
    .from("runs")
    .select("hearts_remaining")
    .eq("id", runId)
    .single();
  assert(after.hearts_remaining === 3, "the run was actually modified by anon");
});

await check("anon cannot delete a run", async () => {
  const runId = await makeRun();
  await anon.from("runs").delete().eq("id", runId);
  const { data } = await service.from("runs").select("id").eq("id", runId);
  assert(data.length === 1, "anon was able to delete a run");
});

await check("anon CAN read a run by id (capability URL)", async () => {
  const runId = await makeRun();
  const { data, error } = await anon.from("runs").select("id").eq("id", runId);
  assert(!error, error?.message);
  assert(data.length === 1, "anon could not read a run it holds the id for");
});

await check("anon cannot execute match_chunks", async () => {
  // Two things must hold, and the second is the one that matters:
  // EXECUTE is revoked (so the call fails outright), and even if it were
  // granted, `security invoker` + RLS means it returns nothing.
  const runId = await makeRun();
  const v = Array(1536).fill(0);
  v[0] = 1;
  await service.from("chunks").insert({
    run_id: runId,
    file_path: "secret.ts",
    start_line: 1,
    end_line: 2,
    content: "source text that must not leave the server",
    embedding: JSON.stringify(v),
  });

  const { data, error } = await anon.rpc("match_chunks", {
    p_run_id: runId,
    p_embedding: JSON.stringify(v),
    p_match_count: 5,
  });

  assert(
    error || !data || data.length === 0,
    `anon retrieved ${data?.length} chunks through match_chunks`,
  );
  assert(
    error,
    "anon can still CALL match_chunks -- the PUBLIC execute grant was not revoked",
  );
});

console.log("\nSnapshot cache key (partial unique index)");
await check("two ready snapshots of the same commit collide", async () => {
  const owner = `verify-${Math.random().toString(36).slice(2, 8)}`;
  const repo = "dupe";
  await makeRun({ owner, repo, status: "ready" });

  const { error } = await service.from("runs").insert({
    owner,
    repo,
    commit_sha: SHA,
    anon_id: uuid(),
    status: "ready",
  });
  assert(error, "a second ready snapshot for the same commit was allowed");
  assert(
    error.code === "23505",
    `expected a unique violation, got ${error.code}: ${error.message}`,
  );
});

await check("a pending run does NOT collide (index is partial)", async () => {
  const owner = `verify-${Math.random().toString(36).slice(2, 8)}`;
  const repo = "partial";
  await makeRun({ owner, repo, status: "ready" });
  // Same commit, but still indexing -- must be allowed, or no one could ever
  // start a second attempt while the first was running.
  await makeRun({ owner, repo, status: "indexing" });
});

await check("a retake pointing at a snapshot does NOT collide", async () => {
  const owner = `verify-${Math.random().toString(36).slice(2, 8)}`;
  const repo = "retake";
  const snapshotId = await makeRun({ owner, repo, status: "ready" });
  // This is what Try Again and a cached start both do.
  await makeRun({
    owner,
    repo,
    status: "ready",
    snapshot_run_id: snapshotId,
  });
});

console.log("\nConstraints");
await check("chunks rejects an inverted line range", async () => {
  const runId = await makeRun();
  const { error } = await service.from("chunks").insert({
    run_id: runId,
    file_path: "a.ts",
    start_line: 10,
    end_line: 5,
    content: "x",
  });
  assert(error, "an inverted line range was accepted");
});

await check("chunks rejects line 0", async () => {
  const runId = await makeRun();
  const { error } = await service.from("chunks").insert({
    run_id: runId,
    file_path: "a.ts",
    start_line: 0,
    end_line: 5,
    content: "x",
  });
  assert(error, "start_line 0 was accepted");
});

await check("questions rejects anything but four options", async () => {
  const runId = await makeRun();
  const { error } = await service.from("questions").insert({
    run_id: runId,
    order_index: 0,
    topic: "apis",
    prompt: "p",
    options: [{ label: "A" }, { label: "B" }],
    correct_index: 0,
  });
  assert(error, "a three-option question was accepted");
});

await check("questions rejects an unknown topic", async () => {
  const runId = await makeRun();
  const { error } = await service.from("questions").insert({
    run_id: runId,
    order_index: 0,
    topic: "not_a_topic",
    prompt: "p",
    options: [0, 1, 2, 3].map((i) => ({ label: String(i) })),
    correct_index: 0,
  });
  assert(error, "an unknown topic was accepted");
});

await check("answers is unique per (run, question)", async () => {
  const runId = await makeRun();
  const { data: q, error: qError } = await service
    .from("questions")
    .insert({
      run_id: runId,
      order_index: 0,
      topic: "apis",
      prompt: "p",
      options: ["A", "B", "C", "D"].map((label) => ({
        label,
        text: label,
        explanation: "",
        citation: null,
        verified: false,
      })),
      correct_index: 0,
    })
    .select("id")
    .single();
  assert(!qError, qError?.message);

  await service
    .from("answers")
    .insert({ run_id: runId, question_id: q.id, selected_index: 0, is_correct: true });

  const { error } = await service
    .from("answers")
    .insert({ run_id: runId, question_id: q.id, selected_index: 1, is_correct: false });

  assert(error?.code === "23505", "a duplicate answer was accepted");
});

console.log("\nVector retrieval");
await check("match_chunks orders by cosine distance", async () => {
  const runId = await makeRun();

  // Three orthogonal-ish vectors. The query is closest to `near`.
  const vec = (i) => {
    const v = Array(1536).fill(0);
    v[i] = 1;
    return v;
  };

  const rows = [
    { name: "near", embedding: vec(0) },
    { name: "mid", embedding: [0.7071, 0.7071, ...Array(1534).fill(0)] },
    { name: "far", embedding: vec(1) },
  ];

  for (const [i, row] of rows.entries()) {
    const { error } = await service.from("chunks").insert({
      run_id: runId,
      file_path: `${row.name}.ts`,
      start_line: 1,
      end_line: 2,
      content: row.name,
      embedding: JSON.stringify(row.embedding),
    });
    assert(!error, `insert ${row.name}: ${error?.message}`);
    void i;
  }

  const { data, error } = await service.rpc("match_chunks", {
    p_run_id: runId,
    p_embedding: JSON.stringify(vec(0)),
    p_match_count: 3,
  });
  assert(!error, error?.message);
  assert(data.length === 3, `expected 3 rows, got ${data.length}`);

  assert(
    data[0].file_path === "near.ts",
    `nearest should be near.ts, got ${data[0].file_path}`,
  );
  assert(
    data[2].file_path === "far.ts",
    `furthest should be far.ts, got ${data[2].file_path}`,
  );

  // Similarity is 1 - cosine distance, so it must descend.
  assert(
    data[0].similarity >= data[1].similarity &&
      data[1].similarity >= data[2].similarity,
    `similarity is not descending: ${data.map((d) => d.similarity.toFixed(3)).join(", ")}`,
  );
  assert(
    Math.abs(data[0].similarity - 1) < 1e-4,
    `identical vectors should score ~1, got ${data[0].similarity}`,
  );
  assert(
    Math.abs(data[2].similarity) < 1e-4,
    `orthogonal vectors should score ~0, got ${data[2].similarity}`,
  );
});

await check("match_chunks is scoped to one run", async () => {
  const runA = await makeRun();
  const runB = await makeRun();
  const v = Array(1536).fill(0);
  v[5] = 1;

  await service.from("chunks").insert({
    run_id: runB,
    file_path: "other-run.ts",
    start_line: 1,
    end_line: 2,
    content: "x",
    embedding: JSON.stringify(v),
  });

  const { data } = await service.rpc("match_chunks", {
    p_run_id: runA,
    p_embedding: JSON.stringify(v),
    p_match_count: 5,
  });
  assert(data.length === 0, "retrieval leaked chunks from another run");
});

await check("match_chunks respects the match count", async () => {
  const runId = await makeRun();
  for (let i = 0; i < 4; i++) {
    const v = Array(1536).fill(0);
    v[i] = 1;
    await service.from("chunks").insert({
      run_id: runId,
      file_path: `f${i}.ts`,
      start_line: 1,
      end_line: 2,
      content: "x",
      embedding: JSON.stringify(v),
    });
  }
  const { data } = await service.rpc("match_chunks", {
    p_run_id: runId,
    p_embedding: JSON.stringify(Array(1536).fill(0).map((_, i) => (i === 0 ? 1 : 0))),
    p_match_count: 2,
  });
  assert(data.length === 2, `expected 2 rows, got ${data.length}`);
});

console.log("\nCascades");
await check("deleting a run removes its chunks, questions and answers", async () => {
  const runId = await makeRun();
  await service.from("chunks").insert({
    run_id: runId,
    file_path: "a.ts",
    start_line: 1,
    end_line: 2,
    content: "x",
  });
  const { data: q } = await service
    .from("questions")
    .insert({
      run_id: runId,
      order_index: 0,
      topic: "apis",
      prompt: "p",
      options: ["A", "B", "C", "D"].map((label) => ({
        label,
        text: label,
        explanation: "",
        citation: null,
        verified: false,
      })),
      correct_index: 0,
    })
    .select("id")
    .single();
  await service
    .from("answers")
    .insert({ run_id: runId, question_id: q.id, selected_index: 0, is_correct: true });

  await service.from("runs").delete().eq("id", runId);

  for (const table of ["chunks", "questions", "answers"]) {
    const { data } = await service.from(table).select("id").eq("run_id", runId);
    assert(data.length === 0, `${table} rows survived the run delete`);
  }
});

// --- teardown ---------------------------------------------------------------

for (const runId of cleanup) {
  await service.from("runs").delete().eq("id", runId);
}
await service.from("runs").delete().eq("owner", "verify");
const { data: leftovers } = await service
  .from("runs")
  .select("id")
  .like("owner", "verify%");
if (leftovers?.length) {
  for (const row of leftovers) await service.from("runs").delete().eq("id", row.id);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
