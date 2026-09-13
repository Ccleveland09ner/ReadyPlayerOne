/**
 * Screen verification against real data.
 *
 *   node scripts/verify-screens.mjs http://localhost:3000
 *
 * Seeds a player with enough finished runs to exercise History pagination and
 * the Report aggregate, then fetches every screen as that browser would --
 * carrying the anon cookie -- and asserts the rendered HTML contains the
 * numbers the database says it should.
 *
 * Costs nothing: rows are written directly, no model or embedding calls. This
 * is the half of the product the pipeline tests never touch, because ingestion
 * and generation stop at the moment a run becomes readable.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

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
// rpo_seen is what proxy.ts uses to decide a browser has already been shown
// the landing screen. Without it every page below 307s to / and the
// assertions all fail against a redirect body rather than the screen.
const cookie = `rpo_aid=${anonId}; rpo_seen=1`;
const runIds = [];

const get = async (path) => {
  const response = await fetch(`${baseUrl}${path}`, { headers: { cookie } });
  return { status: response.status, html: await response.text() };
};

/** Visible text only, so assertions do not match class names or JSON payloads. */
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    // React SSR separates adjacent expressions with <!-- -->, so `{owner}/{repo}`
    // renders as `owner<!-- -->/<!-- -->repo`. Strip comments before tags or the
    // text comes out with spaces the reader never sees.
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ");

const TOPICS = ["file_structure", "core_logic", "apis", "testing", "deployment"];
const OPTIONS = (correct) =>
  ["A", "B", "C", "D"].map((label, i) => ({
    label,
    text: `Option ${label}`,
    explanation: `Why ${label} is ${i === correct ? "right" : "wrong"}.`,
    citation: i === correct ? { path: "src/index.ts", startLine: 10, endLine: 20 } : null,
    verified: i === correct,
  }));

console.log(`\nVerifying screens at ${baseUrl}\n`);

try {
  // --- seed 12 finished runs: two pages of history, a real trend ------------
  const scores = [5, 4, 3, 4, 2, 5, 3, 4, 1, 5, 2, 3];

  for (const [i, score] of scores.entries()) {
    const { data: run } = await db
      .from("runs")
      .insert({
        owner: "screentest",
        repo: `repo-${String(i).padStart(2, "0")}`,
        commit_sha: "d".repeat(40),
        anon_id: anonId,
        status: "complete",
        completed_at: new Date(Date.now() - (12 - i) * 86_400_000).toISOString(),
        created_at: new Date(Date.now() - (12 - i) * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    runIds.push(run.id);

    for (let q = 0; q < 5; q++) {
      const correct = q % 4;
      const { data: question } = await db
        .from("questions")
        .insert({
          run_id: run.id,
          order_index: q,
          topic: TOPICS[q],
          prompt: `Question ${q + 1} about repo-${i}?`,
          options: OPTIONS(correct),
          correct_index: correct,
        })
        .select("id")
        .single();

      const isCorrect = q < score;
      await db.from("answers").insert({
        run_id: run.id,
        question_id: question.id,
        selected_index: isCorrect ? correct : (correct + 1) % 4,
        is_correct: isCorrect,
        streak_at_answer: isCorrect ? q + 1 : 0,
      });
    }
  }
  check("seeded 12 completed runs", runIds.length === 12);

  const totalCorrect = scores.reduce((a, b) => a + b, 0);
  const best = Math.max(...scores) * 20;
  const average = Math.round(
    scores.reduce((sum, s) => sum + s * 20, 0) / scores.length,
  );

  // --- History --------------------------------------------------------------
  const page1 = await get("/history");
  const t1 = textOf(page1.html);
  check("history renders", page1.status === 200);
  check("history shows the total", t1.includes("TOTAL QUIZZES") && / 12 /.test(t1), "12");
  check("history shows 10 rows on page 1", (t1.match(/screentest\/repo-/g) ?? []).length === 10);
  check("history paginates", t1.includes("PAGE 1 / 2"));
  check("history marks a best run", t1.includes("🏆") || page1.html.includes("trophy"));

  const page2 = await get("/history?page=2");
  const t2 = textOf(page2.html);
  check("history page 2 renders the remainder", (t2.match(/screentest\/repo-/g) ?? []).length === 2);
  check("history page 2 knows where it is", t2.includes("PAGE 2 / 2"));

  // --- Report ---------------------------------------------------------------
  const report = await get("/report");
  const tr = textOf(report.html);
  check("report renders", report.status === 200);
  check("report counts the quizzes", new RegExp(`TOTAL QUIZZES\\s+12`).test(tr), "12");
  check("report computes the average", tr.includes(`${average}%`), `${average}%`);
  check("report computes the best", tr.includes(`${best}%`), `${best}%`);
  check("report lists recent activity", tr.includes("RECENT ACTIVITY"));
  check("report derives insights", tr.includes("INSIGHTS") && /perform best in|improved by|Focus more on/.test(tr));

  // --- HUD progression (derived, never stored) ------------------------------
  const xp = totalCorrect * 10 + scores.length * 25;
  const level = Math.floor(xp / 100) + 1;
  check(
    "HUD derives level from answers",
    tr.includes(`Lv. ${level}`),
    `${totalCorrect} correct + ${scores.length} quizzes = ${xp}xp -> Lv. ${level}`,
  );

  // --- Quiz Complete --------------------------------------------------------
  const complete = await get(`/runs/${runIds[0]}/complete`);
  const tc = textOf(complete.html);
  check("quiz complete renders", complete.status === 200);
  check("quiz complete shows the score", tc.includes(`${scores[0]} / 5`), `${scores[0]}/5`);
  check("quiz complete shows a mastery tier", /CODEBASE MASTER|WELL KNOWLEDGEABLE|GETTING THERE|KEEP PRACTICING/i.test(tc));
  const TOPIC_LABELS = ["File Structure", "Core Logic", "APIs", "Testing", "Deployment"];
  check(
    "quiz complete lists all five topics",
    TOPIC_LABELS.every((label) => tc.includes(label)),
  );

  // --- Answer Review --------------------------------------------------------
  // Use a run with wrong answers: the screen shows the chosen option and the
  // correct one, so a perfect run has no uncited option to label.
  const imperfect = runIds[scores.indexOf(Math.min(...scores))];
  const review = await get(`/runs/${imperfect}/answers`);
  const tv = textOf(review.html);
  check("answer review renders", review.status === 200);
  check("answer review shows all five questions", (tv.match(/Question \d about/g) ?? []).length === 5);
  check("answer review renders verified citations", tv.includes("src/index.ts:10"));
  check(
    "answer review links to the pinned commit",
    review.html.includes(`/blob/${"d".repeat(40)}/src/index.ts#L10-L20`),
  );
  check("answer review labels uncited options", tv.includes("LOW CONFIDENCE"));

  // --- Isolation: another browser sees none of this -------------------------
  const otherCookie = `rpo_aid=${crypto.randomUUID()}; rpo_seen=1`;
  const otherHistory = await fetch(`${baseUrl}/history`, {
    headers: { cookie: otherCookie },
  });
  const otherText = textOf(await otherHistory.text());
  check(
    "another browser sees no runs",
    !otherText.includes("screentest/repo-") && otherText.includes("No runs yet"),
  );
} finally {
  for (const id of runIds) await db.from("runs").delete().eq("id", id);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
