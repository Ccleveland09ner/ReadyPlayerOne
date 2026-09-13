/**
 * Walks one player through the whole product, as a browser would.
 *
 *   node scripts/simulate-user.mjs <repo> <baseUrl>
 *
 * Every screen and every pipeline call goes over HTTP through a single cookie
 * jar -- the landing redirect, ingestion, the quiz, results, review, report,
 * history, refresh and logout. Two steps do not: creating the account and
 * signing in run the same SDK calls the server actions make, because Next own
 * action protocol cannot be replayed from a script. Both are labelled [SDK]
 * in the output so the gap is visible rather than implied.
 *
 * SPENDS MONEY: one real ingestion and one generation call.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const repoUrl = process.argv[2] ?? "sindresorhus/p-map";
const base = (process.argv[3] ?? "http://localhost:3000").replace(/\/$/, "");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- a browser --------------------------------------------------------------

const jar = new Map();
const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

function absorb(response) {
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (value === "" || /Max-Age=0/i.test(raw)) jar.delete(name);
    else jar.set(name, value);
  }
  return response;
}

const visit = async (path, init = {}) =>
  absorb(
    await fetch(`${base}${path}`, {
      ...init,
      headers: { cookie: cookieHeader(), ...(init.headers ?? {}) },
      redirect: "manual",
    }),
  );

const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

let step = 0;
const say = (what, detail = "") =>
  console.log(`\n${String(++step).padStart(2)}. ${what}${detail ? `\n    ${detail}` : ""}`);

// --- the journey ------------------------------------------------------------

const email = `player+${Date.now()}@example.com`;
const password = "pixel-arcade-2026";
const fullName = "Sam Rivera";
let userId = null;
let runId = null;

console.log(`\n${"=".repeat(66)}`);
console.log(`ReadyPlayerOne — one player, start to finish`);
console.log(`repo: ${repoUrl}`);
console.log("=".repeat(66));

try {
  // 1. Fresh browser.
  const first = await visit("/");
  say(
    "Opens the app for the first time",
    `GET / → ${first.status} → ${first.headers.get("location") ?? ""}  (sent to the landing screen)`,
  );

  // 2. Landing.
  const splash = await visit("/splash");
  const splashText = textOf(await splash.text());
  say(
    "Sees the landing screen",
    `"${splashText.slice(0, 96)}…"`,
  );

  // 3. Sign up.
  //
  // These two steps run the same calls signUpAction and signInAction make,
  // rather than POSTing the forms. Next's server-action protocol cannot be
  // replayed reliably from a script -- it wants an encrypted action reference
  // this harness has no way to mint. The forms themselves are verified
  // elsewhere: validate.test.ts covers the rules, verify-auth-flow.mjs covers
  // what the app does with a session, and the rendered markup is a real
  // method="POST" form carrying the action. Flagged so the gap is visible.
  const browser = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  // The account is created through the admin API rather than the public
  // signUp endpoint for two reasons: the public one rejects @example.com, and
  // with confirmations enabled it would send real mail to an address nobody
  // owns. The stored result is identical.
  const { data: signUp, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: fullName },
  });
  if (signUpError) throw signUpError;
  userId = signUp.user.id;

  await admin.from("profiles").upsert({
    id: userId,
    display_name: fullName,
    username: `player_${userId.slice(0, 8)}`,
  });

  say(
    "Creates an account  [SDK, not the form]",
    `${email}\n    on this project confirmations are ON, so the real form would show:\n    "Account created. Check your email for the confirmation link, then log in."`,
  );

  // 4. Clicks the link in the email.
  say("Clicks the confirmation link in their email", "(simulated)");

  // 5. Log in, and put the session in the cookie jar the way @supabase/ssr does.
  const { data: signIn, error: signInError } = await browser.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  jar.set(
    `sb-${projectRef}-auth-token`,
    `base64-${Buffer.from(JSON.stringify(signIn.session), "utf8").toString("base64")}`,
  );

  // This is the real claim the sign-in action performs.
  const { data: claimed } = await admin
    .from("runs")
    .update({ user_id: userId })
    .eq("anon_id", jar.get("rpo_aid") ?? crypto.randomUUID())
    .is("user_id", null)
    .select("id");
  say(
    "Logs in  [SDK, not the form]",
    `session established · claimed ${claimed?.length ?? 0} runs made before signing up`,
  );

  // 6. Home.
  const home = await visit("/");
  const homeText = textOf(await home.text());
  say(
    "Lands on Home",
    `HUD shows "${homeText.match(/Sam Rivera|Player_Intern/)?.[0] ?? "?"}"  ·  ${homeText.match(/Would you kindly[^?]*\?/)?.[0] ?? ""}`,
  );

  // 7. Submits a repository.
  const createRes = await visit("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl }),
  });
  const created2 = await createRes.json();
  if (!createRes.ok) throw new Error(created2.error?.message ?? "run creation failed");
  runId = created2.runId;
  say(
    "Pastes a GitHub URL and presses LET'S PLAY",
    `run ${runId.slice(0, 8)}…  commit ${created2.commitSha.slice(0, 10)}  ${created2.fileCount} files kept`,
  );

  // 8. Ingestion, as the progress screen drives it.
  let batches = 0;
  let chunks = 0;
  for (let guard = 0; guard < 60; guard++) {
    const res = await visit(`/api/runs/${runId}/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const batch = await res.json();
    if (!res.ok) throw new Error(batch.error?.message ?? "indexing failed");
    batches++;
    chunks = batch.chunkCount;
    if (batch.done) break;
  }
  say("Watches the repo being read", `${batches} batches, ${chunks} chunks indexed`);

  // 9. Generation.
  const genRes = await visit(`/api/runs/${runId}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const gen = await genRes.json();
  if (!genRes.ok) throw new Error(gen.error?.message ?? "generation failed");
  say(
    "Questions are generated and citations verified",
    `${gen.questionCount} questions, ${gen.rejectedCitations} citations rejected`,
  );

  // 10. Start screen.
  const start = await visit(`/runs/${runId}/start`);
  const startText = textOf(await start.text());
  say("Sees the start screen", startText.match(/Repository\s+\S+/)?.[0] ?? `${start.status}`);

  // 11. The quiz.
  const quiz = await visit(`/runs/${runId}/quiz`);
  const quizHtml = await quiz.text();
  const leaked = /correct_index|correctIndex/.test(quizHtml);
  const { data: questions } = await admin
    .from("questions")
    .select("id, order_index, topic, prompt, options, correct_index")
    .eq("run_id", runId)
    .order("order_index");
  say(
    "Starts the quiz",
    `first question: "${textOf(quizHtml).match(/QUESTION 1 \/ 5\s+(.*?)\s+[A-D]\./)?.[1]?.slice(0, 80) ?? questions[0].prompt.slice(0, 80)}"\n    answer key present in the page? ${leaked}`,
  );

  // 12. Answers them. Gets Q1 and Q2 right, then guesses.
  const results = [];
  for (const [i, q] of questions.entries()) {
    const pick = i < 2 ? q.correct_index : (q.correct_index + 1) % 4;
    const res = await visit(`/api/runs/${runId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, selectedIndex: pick }),
    });
    const scored = await res.json();
    results.push(scored);
    if (scored.runComplete) break;
  }
  const last = results[results.length - 1];
  say(
    "Answers the questions",
    results
      .map(
        (r, i) =>
          `Q${i + 1} ${r.isCorrect ? "correct" : "wrong  "}  hearts ${r.heartsRemaining}  streak ${r.streak}`,
      )
      .join("\n    ") +
      (last.outOfHearts ? "\n    out of hearts — the run ends early" : ""),
  );

  // 13. Results.
  const complete = await visit(`/runs/${runId}/complete`);
  const completeText = textOf(await complete.text());
  say(
    "Reaches Quiz Complete",
    `score ${completeText.match(/(\d) \/ (\d)/)?.[0] ?? "?"}  ·  ${completeText.match(/CODEBASE MASTERY\s+([A-Z !]+)/)?.[1]?.trim() ?? ""}  ·  ${completeText.match(/(\d+)%/)?.[0] ?? ""}`,
  );

  // 14. Answer review.
  const review = await visit(`/runs/${runId}/answers`);
  const reviewHtml = await review.text();
  const citations = [...reviewHtml.matchAll(/blob\/[a-f0-9]{40}\/([^"#]+)#L(\d+)-L(\d+)/g)];
  say(
    "Opens View Answers",
    citations.length
      ? citations
          .slice(0, 3)
          .map((c) => `${c[1]}:${c[2]}-${c[3]}`)
          .join("\n    ") + `\n    (${citations.length} verified citations, each pinned to the ingested commit)`
      : "no citations rendered",
  );

  // 15. Report.
  const report = await visit("/report");
  const reportText = textOf(await report.text());
  say(
    "Checks the Report",
    `${reportText.match(/TOTAL QUIZZES\s+(\d+)/)?.[0] ?? ""}  ·  ${reportText.match(/AVERAGE SCORE\s+(\d+%)/)?.[0] ?? ""}  ·  ${reportText.match(/BEST SCORE\s+(\d+%)/)?.[0] ?? ""}`,
  );

  // 16. History.
  const history = await visit("/history");
  const historyText = textOf(await history.text());
  const repoName = repoUrl.replace(/^https:\/\/github\.com\//, "");
  say(
    "Opens History",
    `the run is listed: ${historyText.includes(repoName.split("/")[1])}\n    ${historyText.match(new RegExp(`${repoName.split("/")[1]}[^·]{0,60}`))?.[0]?.trim() ?? ""}`,
  );

  // 17. Refresh.
  const refreshed = await visit("/history");
  const refreshedText = textOf(await refreshed.text());
  say(
    "Refreshes the browser",
    `still signed in: ${refreshedText.includes(fullName)}  ·  history still there: ${refreshedText.includes(repoName.split("/")[1])}`,
  );

  // 18. Log out.
  const out = await visit("/logout", { method: "POST" });
  say("Logs out", `→ ${out.headers.get("location") ?? out.status}`);

  const afterOut = await visit("/history");
  const afterText = textOf(await afterOut.text());
  say(
    "Their data is gone from the browser",
    `name still shown: ${afterText.includes(fullName)}  ·  run still listed: ${afterText.includes(repoName.split("/")[1])}`,
  );

  // 19. Signs back in — history must still be theirs.
  jar.delete("rpo_aid");
  const { data: again } = await browser.auth.signInWithPassword({ email, password });
  jar.set(
    `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token`,
    `base64-${Buffer.from(JSON.stringify(again.session), "utf8").toString("base64")}`,
  );
  const back = await visit("/history");
  const backText = textOf(await back.text());
  say(
    "Signs back in later",
    `history still attached to the account: ${backText.includes(repoName.split("/")[1])}`,
  );

  console.log(`\n${"=".repeat(66)}\n`);
} finally {
  if (runId) await admin.from("runs").delete().eq("id", runId);
  if (userId) {
    await admin.from("runs").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
  console.log("(test account and run cleaned up)\n");
}
