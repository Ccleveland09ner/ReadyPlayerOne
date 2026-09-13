/**
 * Top-bar repository selector verification.
 *
 *   node scripts/verify-repo-selector.mjs http://localhost:3000
 *
 * Seeds four distinct repositories for one browser, then asserts:
 *   - the selector is handed exactly the three most recent, newest first;
 *   - the fourth is not sent to the client at all;
 *   - picking one starts a run and lands on that run's confirm screen.
 *
 * The dropdown list only mounts once it is open, so it cannot be asserted from
 * the server HTML. The props it will mount with can be: React serialises
 * client-component props into the flight payload on the page, so that is what
 * this reads. Costs nothing -- rows are written directly, no model calls.
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
const cookie = `rpo_aid=${anonId}; rpo_seen=1`;
const seeded = [
  { owner: "sindresorhus", repo: "awesome" },
  { owner: "kamranahmedse", repo: "developer-roadmap" },
  { owner: "airbnb", repo: "javascript" },
  { owner: "trekhleb", repo: "javascript-algorithms" }, // newest
];
const runIds = [];

async function seed() {
  // Oldest first, one second apart: recentRepos orders by created_at desc, so
  // ties would make "the three most recent" untestable.
  const base = Date.now() - seeded.length * 1000;
  for (const [i, { owner, repo }] of seeded.entries()) {
    const { data, error } = await db
      .from("runs")
      .insert({
        anon_id: anonId,
        user_id: null,
        owner,
        repo,
        commit_sha: `seed${i}`.padEnd(40, "0"),
        status: "ready",
        created_at: new Date(base + i * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`seed ${owner}/${repo}: ${error.message}`);
    runIds.push(data.id);
  }
}

/** The repos React serialised into the page's flight payload, in order. */
function selectorProps(html) {
  const found = [];
  const re = /\\?"owner\\?":\\?"([^"\\]+)\\?",\\?"repo\\?":\\?"([^"\\]+)\\?",\\?"runId\\?":\\?"([0-9a-f-]{36})\\?"/g;
  for (const m of html.matchAll(re)) {
    const key = `${m[1]}/${m[2]}`;
    if (!found.includes(key)) found.push(key);
  }
  return found;
}

async function main() {
  console.log(`\nRepo selector  ${baseUrl}  anon ${anonId}\n`);
  await seed();

  const home = await fetch(`${baseUrl}/home`, { headers: { cookie } });
  const html = await home.text();
  check("/home renders", home.status === 200, `status ${home.status}`);

  const offered = selectorProps(html);
  const newestThree = seeded
    .slice(-3)
    .reverse()
    .map((r) => `${r.owner}/${r.repo}`);

  check("selector receives three repos", offered.length === 3, offered.join(", "));
  check(
    "newest first, oldest dropped",
    offered.join("|") === newestThree.join("|"),
    `expected ${newestThree.join(", ")}`,
  );
  check(
    "fourth-oldest repo is not sent to the browser",
    !html.includes("sindresorhus"),
  );
  check("trigger is not rounded", !/RepoSelector[^]{0,400}rounded/.test(html));

  // Picking one starts a fresh run against that repo and returns its id.
  const pick = seeded[seeded.length - 1];
  const started = await fetch(`${baseUrl}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ repoUrl: `${pick.owner}/${pick.repo}` }),
  });
  const payload = await started.json().catch(() => ({}));
  check(
    `POST /api/runs accepts the "${pick.owner}/${pick.repo}" shorthand`,
    started.ok && typeof payload.runId === "string",
    started.ok ? payload.runId : JSON.stringify(payload).slice(0, 160),
  );

  if (payload.runId) {
    runIds.push(payload.runId);
    const start = await fetch(`${baseUrl}/runs/${payload.runId}/start`, {
      headers: { cookie },
    });
    const startHtml = await start.text();
    check(
      "the run it creates lands on that repository's confirm screen",
      start.status === 200 && startHtml.includes(pick.repo),
      `status ${start.status}`,
    );
  }

  await db.from("runs").delete().in("id", runIds);
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  if (runIds.length) await db.from("runs").delete().in("id", runIds);
  console.error(error);
  process.exit(1);
});
