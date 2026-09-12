/**
 * Batch pipeline test across many repositories.
 *
 *   node scripts/batch-test.mjs repos.txt http://localhost:3000
 *
 * This is the "manual, scripted checklist" the tech design asks for at hour
 * 18, automated: run the whole pipeline against a list of repositories and
 * report what worked, what failed and why. Every failure is recorded and the
 * run continues -- the point is the distribution of outcomes, not the first
 * error.
 *
 * SPENDS MONEY: embeddings per batch plus one generation call per repository.
 *
 * Writes batch-results.json next to the repo list.
 */

import { readFileSync, writeFileSync } from "node:fs";

const listPath = process.argv[2];
const baseUrl = (process.argv[3] ?? "http://localhost:3000").replace(/\/$/, "");
const limit = Number(process.argv[4] ?? "0");

if (!listPath) {
  console.error("usage: node scripts/batch-test.mjs <repos.txt> [baseUrl] [limit]");
  process.exit(1);
}

let repos = readFileSync(listPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
if (limit > 0) repos = repos.slice(0, limit);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

/** Retries past our own per-caller rate limit rather than recording it as a failure. */
async function postWaitingOutRateLimit(path, body = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await post(path, body);
    if (result.ok) return result;
    if (result.payload?.error?.code !== "rate_limited") return result;

    const waitMs = Math.min(
      60_000,
      (result.payload.error.details?.retryAfterMs ?? 30_000) + 1000,
    );
    process.stdout.write(`  (rate limited, waiting ${Math.round(waitMs / 1000)}s) `);
    await sleep(waitMs);
  }
  return post(path, body);
}

const results = [];
const started = Date.now();

console.log(`\nBatch test: ${repos.length} repositories against ${baseUrl}\n`);

for (const [i, repo] of repos.entries()) {
  const label = repo.replace(/^https:\/\/github\.com\//, "");
  process.stdout.write(`${String(i + 1).padStart(2)}/${repos.length}  ${label.padEnd(52)} `);

  const record = { repo: label, stage: "create", ok: false };
  const t0 = Date.now();

  try {
    // --- create ---
    const created = await postWaitingOutRateLimit("/api/runs", { repoUrl: repo });
    if (!created.ok) {
      record.code = created.payload?.error?.code ?? `http_${created.status}`;
      record.message = created.payload?.error?.message ?? "";
      results.push(record);
      console.log(`FAIL  ${record.code}`);
      continue;
    }

    record.runId = created.payload.runId;
    record.fileCount = created.payload.fileCount;
    record.cached = created.payload.cached;
    record.ingestMs = Date.now() - t0;

    // --- index ---
    record.stage = "index";
    const t1 = Date.now();
    let batches = 0;
    for (let guard = 0; guard < 80; guard++) {
      const batch = await post(`/api/runs/${record.runId}/index`);
      if (!batch.ok) {
        record.code = batch.payload?.error?.code ?? `http_${batch.status}`;
        record.message = batch.payload?.error?.message ?? "";
        break;
      }
      batches++;
      record.chunkCount = batch.payload.chunkCount;
      if (batch.payload.done) break;
    }
    if (record.code) {
      results.push(record);
      console.log(`FAIL  ${record.code}`);
      continue;
    }
    record.batches = batches;
    record.indexMs = Date.now() - t1;

    // --- generate ---
    record.stage = "generate";
    const t2 = Date.now();
    const generated = await post(`/api/runs/${record.runId}/questions`);
    if (!generated.ok) {
      record.code = generated.payload?.error?.code ?? `http_${generated.status}`;
      record.message = generated.payload?.error?.message ?? "";
      record.generateMs = Date.now() - t2;
      results.push(record);
      console.log(`FAIL  ${record.code}  (${(record.generateMs / 1000).toFixed(0)}s)`);
      continue;
    }
    record.questionCount = generated.payload.questionCount;
    record.rejectedCitations = generated.payload.rejectedCitations ?? 0;
    record.regenerated = generated.payload.regenerated ?? false;
    record.generateMs = Date.now() - t2;

    // --- answer everything ---
    record.stage = "answer";
    const { createClient } = await import("@supabase/supabase-js");
    const env = Object.fromEntries(
      readFileSync(new URL("../.env.local", import.meta.url), "utf8")
        .split("\n")
        .filter((l) => l.trim() && !l.trim().startsWith("#"))
        .map((l) => {
          const j = l.indexOf("=");
          return [l.slice(0, j).trim(), l.slice(j + 1).trim()];
        }),
    );
    const db = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );

    const { data: questions } = await db
      .from("questions")
      .select("id, order_index, topic, options, correct_index")
      .eq("run_id", record.runId)
      .order("order_index");

    record.verifiedOptions = questions.reduce(
      (n, q) => n + q.options.filter((o) => o.verified).length,
      0,
    );
    record.totalOptions = questions.reduce((n, q) => n + q.options.length, 0);
    record.answerKeysCited = questions.filter(
      (q) => q.options[q.correct_index]?.verified,
    ).length;
    record.topics = questions.map((q) => q.topic);

    // Answer correctly so the run completes rather than dying on hearts.
    for (const q of questions) {
      const answered = await post(`/api/runs/${record.runId}/answers`, {
        questionId: q.id,
        selectedIndex: q.correct_index,
      });
      if (!answered.ok) {
        record.code = answered.payload?.error?.code ?? `http_${answered.status}`;
        break;
      }
      record.finalHearts = answered.payload.heartsRemaining;
      if (answered.payload.runComplete) break;
    }

    const { data: finalRun } = await db
      .from("runs")
      .select("status, completed_at")
      .eq("id", record.runId)
      .single();
    record.finalStatus = finalRun?.status;

    record.ok = !record.code && finalRun?.status === "complete";
    record.totalMs = Date.now() - t0;
    results.push(record);

    console.log(
      `${record.ok ? "OK  " : "PART"}  ${record.fileCount}f ${record.chunkCount}c  ` +
        `cited ${record.answerKeysCited}/5 keys, ${record.verifiedOptions}/${record.totalOptions} options  ` +
        `${(record.totalMs / 1000).toFixed(0)}s${record.cached ? " (cached)" : ""}`,
    );
  } catch (error) {
    record.code = "harness_error";
    record.message = error.message;
    results.push(record);
    console.log(`FAIL  harness: ${error.message.slice(0, 60)}`);
  }
}

// --- summary -----------------------------------------------------------------

const ok = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

console.log(`\n${"=".repeat(70)}`);
console.log(`${ok.length}/${results.length} completed end to end in ${((Date.now() - started) / 60000).toFixed(1)} min`);

if (failed.length) {
  console.log(`\nFailures by cause:`);
  const byCode = {};
  for (const r of failed) (byCode[r.code] ??= []).push(r.repo);
  for (const [code, repoList] of Object.entries(byCode).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(repoList.length).padStart(2)}  ${code}`);
    for (const r of repoList) console.log(`        ${r}`);
  }
}

if (ok.length) {
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const keys = ok.reduce((n, r) => n + r.answerKeysCited, 0);
  const opts = ok.reduce((n, r) => n + r.verifiedOptions, 0);
  const totalOpts = ok.reduce((n, r) => n + r.totalOptions, 0);

  console.log(`\nOn the ${ok.length} that completed:`);
  console.log(`  answer keys with a verified citation : ${keys}/${ok.length * 5} (${Math.round((keys / (ok.length * 5)) * 100)}%)`);
  console.log(`  all options with a verified citation : ${opts}/${totalOpts} (${Math.round((opts / totalOpts) * 100)}%)`);
  console.log(`  citations rejected by verification    : ${ok.reduce((n, r) => n + r.rejectedCitations, 0)}`);
  console.log(`  regenerated once                      : ${ok.filter((r) => r.regenerated).length}`);
  console.log(`  median ingest / index / generate      : ${median(ok.map((r) => r.ingestMs))}ms / ${median(ok.map((r) => r.indexMs))}ms / ${median(ok.map((r) => r.generateMs))}ms`);
  console.log(`  median files / chunks                 : ${median(ok.map((r) => r.fileCount))} / ${median(ok.map((r) => r.chunkCount))}`);
}

writeFileSync(
  new URL("../batch-results.json", import.meta.url),
  JSON.stringify(results, null, 2),
);
console.log(`\nFull results -> batch-results.json\n`);
