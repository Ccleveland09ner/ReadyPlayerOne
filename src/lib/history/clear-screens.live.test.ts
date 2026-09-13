import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Clearing history, as the screens see it.
 *
 * The sibling suite proves the rows go away. This proves the product agrees:
 * History, the Report aggregate, the HUD's XP meter and the top-bar
 * repository list are all derived from those rows, and every one of them has
 * to come back empty afterwards. "Consistent across the account" is the
 * requirement, and four separate screens is where it would fail.
 *
 * Needs a running server -- `npm run build && npm start`, or point
 * VERIFY_BASE_URL at a deployment. Skips itself when nothing answers, rather
 * than failing a suite someone ran without one.
 */

const baseUrl = (process.env.VERIFY_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

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

const anonId = crypto.randomUUID();
// rpo_seen is what proxy.ts reads to decide this browser has been shown the
// landing screen; without it every fetch below lands on a redirect body.
const cookie = `rpo_aid=${anonId}; rpo_seen=1`;
const created: string[] = [];

// Probed at module scope, not in beforeAll: `describe.skipIf` is evaluated
// when the file is collected, which happens before any hook has run.
const serverUp = await fetch(`${baseUrl}/`)
  .then((r) => r.ok)
  .catch(() => false);

if (!serverUp) {
  console.warn(
    `  clear-screens: nothing answering at ${baseUrl}; skipping. ` +
      `Start one with \`npm start\`, or set VERIFY_BASE_URL.`,
  );
}

/** Visible text only, so assertions cannot match class names or JSON. */
const textOf = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ");

const get = async (path: string) => {
  const response = await fetch(`${baseUrl}${path}`, { headers: { cookie } });
  return textOf(await response.text());
};

async function seedRun(repo: string, score: number) {
  const { data, error } = await db
    .from("runs")
    .insert({
      owner: "cleartest",
      repo,
      commit_sha: repo.padEnd(40, "f"),
      anon_id: anonId,
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  created.push(data.id);

  for (let q = 0; q < 5; q++) {
    const { data: question, error: qError } = await db
      .from("questions")
      .insert({
        run_id: data.id,
        order_index: q,
        topic: ["file_structure", "core_logic", "apis", "testing", "deployment"][q],
        prompt: `Question ${q + 1}?`,
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
    if (qError) throw new Error(qError.message);

    const { error: aError } = await db.from("answers").insert({
      run_id: data.id,
      question_id: question.id,
      selected_index: q < score ? 0 : 1,
      is_correct: q < score,
      streak_at_answer: q < score ? q + 1 : 0,
    });
    if (aError) throw new Error(aError.message);
  }
}

beforeAll(async () => {
  if (!serverUp) return;

  await seedRun("alpha", 5);
  await seedRun("beta", 3);
  await seedRun("gamma", 4);
});

afterAll(async () => {
  if (created.length) await db.from("runs").delete().in("id", created);
});

describe.skipIf(!serverUp)("clearing history, as the screens see it", () => {
  it("shows the seeded runs before anything is cleared", async () => {
    const history = await get("/history");
    expect(history).toContain("alpha");
    expect(history).toContain("gamma");
  });

  it("reports on them and offers to clear them", async () => {
    expect(await get("/report")).toMatch(/ 3 /);
    // The count is what the player is about to lose, shown before they commit.
    expect(await get("/settings")).toContain("CLEAR HISTORY");
  });

  it("clears them", async () => {
    const { clearHistoryFor } = await import("@/lib/history/clear");
    const result = await clearHistoryFor(anonId, null);
    expect(result).toEqual({ deleted: 3, preserved: 0 });
  });

  it("leaves History empty", async () => {
    const history = await get("/history");
    expect(history).not.toContain("alpha");
    expect(history).not.toContain("beta");
    expect(history).not.toContain("gamma");
  });

  it("leaves the Report with nothing to aggregate", async () => {
    const report = await get("/report");
    expect(report).not.toContain("cleartest");
  });

  it("resets the HUD, which is derived from the same answers", async () => {
    expect(await get("/home")).toContain("Lv. 1");
  });

  it("empties the top-bar repository selector", async () => {
    expect(await get("/home")).not.toContain("cleartest");
  });

  it("says there is nothing left to clear", async () => {
    expect(await get("/settings")).toContain("NOTHING TO CLEAR");
  });
});
