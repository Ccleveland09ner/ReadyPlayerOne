/**
 * End-to-end smoke run against a live server.
 *
 *   node scripts/smoke-run.mjs [repo] [baseUrl]
 *   node scripts/smoke-run.mjs sindresorhus/p-map http://localhost:3000
 *
 * Drives the real pipeline the way the browser does: create the run, loop the
 * index batches until the queue drains, generate the questions, then answer
 * them. Prints every generated question with its citations so you can see what
 * a judge would see.
 *
 * This SPENDS MONEY -- embeddings for each batch and one generation call --
 * so it is a script you run deliberately, not a test.
 */

const repo = process.argv[2] ?? "sindresorhus/p-map";
const baseUrl = (process.argv[3] ?? "http://localhost:3000").replace(/\/$/, "");

const started = Date.now();
const since = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

async function post(path, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload.error ?? {};
    throw new Error(
      `${path} -> ${response.status} ${error.code ?? ""}: ${error.message ?? JSON.stringify(payload)}`,
    );
  }
  return payload;
}

console.log(`\nSmoke run: ${repo}\n${"=".repeat(60)}`);

// --- 1. ingest ---------------------------------------------------------------

const run = await post("/api/runs", { repoUrl: repo });
console.log(`[${since()}] run created`);
console.log(`         id      ${run.runId}`);
console.log(`         commit  ${run.commitSha}`);
console.log(`         files   ${run.fileCount}${run.cached ? "  (cached snapshot)" : ""}`);

// --- 2. index ----------------------------------------------------------------

let batches = 0;
let chunkCount = 0;

for (let guard = 0; guard < 60; guard++) {
  const batch = await post(`/api/runs/${run.runId}/index`);
  batches++;
  chunkCount = batch.chunkCount;
  if (batch.done) break;
  console.log(
    `[${since()}] batch ${batches}: +${batch.filesIndexed} files, ${batch.filesRemaining} left, ${batch.chunkCount} chunks`,
  );
}
console.log(`[${since()}] indexing done: ${batches} batches, ${chunkCount} chunks`);

// --- 3. generate -------------------------------------------------------------

const generated = await post(`/api/runs/${run.runId}/questions`);
console.log(
  `[${since()}] generated ${generated.questionCount} questions` +
    (generated.rejectedCitations
      ? `  (${generated.rejectedCitations} citations rejected by verification)`
      : "  (every citation verified)") +
    (generated.regenerated ? "  [regenerated once]" : ""),
);

// --- 4. read them back and answer --------------------------------------------

const anon = process.env.SUPABASE_SERVICE_ROLE_KEY ? null : null;
void anon;

const { createClient } = await import("@supabase/supabase-js");
const { readFileSync } = await import("node:fs");
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

const { data: questions } = await db
  .from("questions")
  .select("id, order_index, topic, prompt, options, correct_index")
  .eq("run_id", run.runId)
  .order("order_index");

console.log(`\n${"=".repeat(60)}\nGenerated quiz\n${"=".repeat(60)}`);

for (const q of questions) {
  console.log(`\nQ${q.order_index + 1}  [${q.topic}]`);
  console.log(`  ${q.prompt}`);
  for (const [i, option] of q.options.entries()) {
    const marker = i === q.correct_index ? "*" : " ";
    const cite = option.verified
      ? `${option.citation.path}:${option.citation.startLine}-${option.citation.endLine}`
      : "NO VERIFIED CITATION";
    console.log(`   ${marker}${option.label}. ${option.text}`);
    console.log(`      ${option.explanation}`);
    console.log(`      ${cite}`);
  }
}

// --- 5. answer every question ------------------------------------------------

console.log(`\n${"=".repeat(60)}\nAnswering (always picking B, to exercise hearts)\n${"=".repeat(60)}`);

let lastResult;
for (const q of questions) {
  lastResult = await post(`/api/runs/${run.runId}/answers`, {
    questionId: q.id,
    selectedIndex: 1,
  });
  console.log(
    `  Q${q.order_index + 1}  ${lastResult.isCorrect ? "correct" : "wrong  "}  hearts=${lastResult.heartsRemaining}  streak=${lastResult.streak}  xp=${lastResult.xpAwarded}`,
  );
  if (lastResult.runComplete) {
    console.log(
      `  run complete${lastResult.outOfHearts ? " -- out of hearts, ended early" : ""}`,
    );
    break;
  }
}

// --- 6. idempotency ----------------------------------------------------------

const replay = await post(`/api/runs/${run.runId}/answers`, {
  questionId: questions[0].id,
  selectedIndex: 3,
});
console.log(
  `\n  resubmitting Q1 with a different answer -> replayed=${replay.replayed}, hearts still ${replay.heartsRemaining}`,
);

const { data: finalRun } = await db
  .from("runs")
  .select("status, hearts_remaining, completed_at")
  .eq("id", run.runId)
  .single();

console.log(
  `\n[${since()}] final: status=${finalRun.status} hearts=${finalRun.hearts_remaining} completed=${finalRun.completed_at ? "yes" : "no"}`,
);
console.log(`\nReview it at ${baseUrl}/runs/${run.runId}/answers\n`);
