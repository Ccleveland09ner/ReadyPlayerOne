import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/env";
import { readAnonId } from "@/lib/identity";
import { createClient } from "@/lib/supabase/server";
import { masteryFor, percentFor, type MasteryTone } from "@/lib/progression/mastery";
import { TOPIC_ORDER, type Topic } from "@/lib/types";

/**
 * Run history and the report aggregate.
 *
 * Both read server-side only, scoped by the anon_id cookie and the signed-in
 * user id. The client never supplies an identity -- it could otherwise read
 * anyone's history by guessing a uuid.
 *
 * Offset pagination is right here. Cursor pagination is strictly better at
 * scale and strictly more work, and nobody in this hackathon will have 500
 * runs.
 */

export const HISTORY_PAGE_SIZE = 10;

export type HistoryRow = {
  runId: string;
  owner: string;
  repo: string;
  createdAt: string;
  score: number;
  total: number;
  percent: number;
  mastery: string;
  masteryTone: MasteryTone;
  completed: boolean;
  /** Where View Results should go for this run's state. */
  href: string;
  best: boolean;
};

type RunRow = {
  id: string;
  owner: string;
  repo: string;
  question_count: number;
  completed_at: string | null;
  created_at: string;
};

/** Identity for the current request: cookie anon id plus any signed-in user. */
export async function currentIdentity(): Promise<{
  anonId: string | null;
  userId: string | null;
}> {
  if (!isSupabaseConfigured()) return { anonId: null, userId: null };

  const anonId = await readAnonId();

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Supabase not configured; anonymous play still works.
  }

  return { anonId, userId };
}

/**
 * The `.or()` filter that scopes every history and report read to one player.
 *
 * A run matches on the browser's anon id ONLY while it is still unclaimed.
 * Once a run belongs to an account it is reachable through `user_id` alone, so
 * signing out on a shared machine stops showing it. A claimed run keeps its
 * `anon_id` forever, and matching on that unconditionally meant the next
 * person to use the browser saw the last person's quiz history.
 */
function identityFilter(anonId: string | null, userId: string | null): string | null {
  const clauses: string[] = [];
  if (anonId) clauses.push(`and(anon_id.eq.${anonId},user_id.is.null)`);
  if (userId) clauses.push(`user_id.eq.${userId}`);
  return clauses.length ? clauses.join(",") : null;
}

async function scoreByRun(
  runIds: string[],
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (runIds.length === 0) return scores;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("answers")
    .select("run_id, is_correct")
    .in("run_id", runIds);

  for (const row of data ?? []) {
    if (row.is_correct) {
      scores.set(row.run_id, (scores.get(row.run_id) ?? 0) + 1);
    }
  }
  return scores;
}

function toHistoryRow(
  run: RunRow,
  score: number,
  firstUnanswered: number | null,
): HistoryRow {
  const total = run.question_count;
  const percent = percentFor(score, total);
  const tier = masteryFor(percent);
  const completed = run.completed_at !== null;

  return {
    runId: run.id,
    owner: run.owner,
    repo: run.repo,
    createdAt: run.created_at,
    score,
    total,
    percent,
    mastery: tier.name,
    masteryTone: tier.tone,
    completed,
    href: completed
      ? `/runs/${run.id}/complete`
      : `/runs/${run.id}/quiz${firstUnanswered !== null ? `?q=${firstUnanswered}` : ""}`,
    best: false,
  };
}

export async function listRuns(page: number): Promise<{
  rows: HistoryRow[];
  total: number;
  pageCount: number;
}> {
  if (!isSupabaseConfigured()) return { rows: [], total: 0, pageCount: 1 };

  const { anonId, userId } = await currentIdentity();
  const filter = identityFilter(anonId, userId);
  if (!filter) return { rows: [], total: 0, pageCount: 1 };

  const supabase = createServiceClient();
  const from = (page - 1) * HISTORY_PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("runs")
    .select("id, owner, repo, question_count, completed_at, created_at", {
      count: "exact",
    })
    .or(filter)
    .order("created_at", { ascending: false })
    .range(from, from + HISTORY_PAGE_SIZE - 1);

  if (error) throw new Error(`History query failed: ${error.message}`);

  const runs = (data ?? []) as RunRow[];
  const scores = await scoreByRun(runs.map((run) => run.id));

  // Resume position for any run still in progress.
  const unfinished = runs.filter((run) => !run.completed_at).map((run) => run.id);
  const resumeAt = new Map<string, number>();
  if (unfinished.length) {
    const { data: answered } = await supabase
      .from("answers")
      .select("run_id, questions(order_index)")
      .in("run_id", unfinished);

    const counts = new Map<string, number>();
    for (const row of answered ?? []) {
      counts.set(row.run_id, (counts.get(row.run_id) ?? 0) + 1);
    }
    for (const runId of unfinished) resumeAt.set(runId, counts.get(runId) ?? 0);
  }

  const rows = runs.map((run) =>
    toHistoryRow(run, scores.get(run.id) ?? 0, resumeAt.get(run.id) ?? null),
  );

  // Trophy on the best score of this page.
  let bestIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (bestIndex === -1 || rows[i].percent > rows[bestIndex].percent) bestIndex = i;
  }
  if (bestIndex >= 0 && rows[bestIndex].completed) rows[bestIndex].best = true;

  const total = count ?? rows.length;
  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
  };
}

export type ReportData = {
  quizzes: number;
  averagePercent: number;
  bestPercent: number;
  strongTopics: number;
  topicCount: number;
  trend: { label: string; percent: number }[];
  topicAccuracy: { topic: Topic; pct: number; good: boolean }[];
  recent: HistoryRow[];
  insights: string[];
};

/**
 * One grouped read over this player's answers, plus one ordered read for the
 * trend. The insights are template strings computed from those numbers -- a
 * model call here would cost latency and money to produce text that can be
 * wrong about data we already have exactly.
 */
export async function buildReport(): Promise<ReportData> {
  const { anonId, userId } = await currentIdentity();
  const filter = identityFilter(anonId, userId);

  const empty: ReportData = {
    quizzes: 0,
    averagePercent: 0,
    bestPercent: 0,
    strongTopics: 0,
    topicCount: TOPIC_ORDER.length,
    trend: [],
    topicAccuracy: TOPIC_ORDER.map((topic) => ({ topic, pct: 0, good: false })),
    recent: [],
    insights: [],
  };
  if (!filter || !isSupabaseConfigured()) return empty;

  const supabase = createServiceClient();

  const { data: runData } = await supabase
    .from("runs")
    .select("id, owner, repo, question_count, completed_at, created_at")
    .or(filter)
    .not("completed_at", "is", null)
    .order("created_at", { ascending: true });

  const runs = (runData ?? []) as RunRow[];
  if (runs.length === 0) return empty;

  const { data: answerData } = await supabase
    .from("answers")
    .select("run_id, is_correct, questions(topic)")
    .in(
      "run_id",
      runs.map((run) => run.id),
    );

  type AnswerJoin = {
    run_id: string;
    is_correct: boolean;
    questions: { topic: Topic } | { topic: Topic }[] | null;
  };

  const scores = new Map<string, number>();
  const byTopic = new Map<Topic, { correct: number; total: number }>();

  for (const row of (answerData ?? []) as AnswerJoin[]) {
    if (row.is_correct) scores.set(row.run_id, (scores.get(row.run_id) ?? 0) + 1);

    const joined = Array.isArray(row.questions) ? row.questions[0] : row.questions;
    const topic = joined?.topic;
    if (!topic) continue;

    const bucket = byTopic.get(topic) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (row.is_correct) bucket.correct += 1;
    byTopic.set(topic, bucket);
  }

  const percents = runs.map((run) =>
    percentFor(scores.get(run.id) ?? 0, run.question_count),
  );

  const dateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  const topicAccuracy = TOPIC_ORDER.map((topic) => {
    const bucket = byTopic.get(topic);
    const pct = bucket && bucket.total > 0
      ? Math.round((bucket.correct / bucket.total) * 100)
      : 0;
    return { topic, pct, good: pct >= 75 };
  });

  const recentRuns = [...runs].reverse().slice(0, 5);
  const recent = recentRuns.map((run) =>
    toHistoryRow(run, scores.get(run.id) ?? 0, null),
  );

  const average = Math.round(
    percents.reduce((sum, p) => sum + p, 0) / percents.length,
  );

  return {
    quizzes: runs.length,
    averagePercent: average,
    bestPercent: Math.max(...percents),
    strongTopics: topicAccuracy.filter((t) => t.good).length,
    topicCount: TOPIC_ORDER.length,
    trend: runs.map((run, i) => ({
      label: dateFormat.format(new Date(run.created_at)),
      percent: percents[i],
    })),
    topicAccuracy,
    recent,
    insights: buildInsights(percents, topicAccuracy),
  };
}

function buildInsights(
  percents: number[],
  topics: { topic: Topic; pct: number }[],
): string[] {
  const insights: string[] = [];

  if (percents.length >= 2) {
    const delta = percents[percents.length - 1] - percents[0];
    if (delta > 0) {
      insights.push(`Your scores have improved by ${delta}% over time!`);
    } else if (delta < 0) {
      insights.push(
        `Your scores are down ${Math.abs(delta)}% since your first run -- try a repo you have already read.`,
      );
    } else {
      insights.push("Your scores are holding steady. Try a larger repository.");
    }
  }

  const ranked = [...topics].sort((a, b) => b.pct - a.pct);
  const strong = ranked.filter((t) => t.pct > 0).slice(0, 2);
  if (strong.length === 2) {
    insights.push(
      `You perform best in ${label(strong[0].topic)} and ${label(strong[1].topic)}.`,
    );
  } else if (strong.length === 1) {
    insights.push(`You perform best in ${label(strong[0].topic)}.`);
  }

  const weakest = ranked[ranked.length - 1];
  if (weakest && weakest.pct < 75) {
    insights.push(
      `Focus more on ${label(weakest.topic)} to improve your overall score.`,
    );
  }

  return insights;
}

function label(topic: Topic): string {
  return topic
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Derived HUD numbers: correct answers and completed quizzes for this player. */
export async function playerTotals(): Promise<{
  correct: number;
  quizzes: number;
}> {
  if (!isSupabaseConfigured()) return { correct: 0, quizzes: 0 };

  const { anonId, userId } = await currentIdentity();
  const filter = identityFilter(anonId, userId);
  if (!filter) return { correct: 0, quizzes: 0 };

  const supabase = createServiceClient();
  const { data: runData } = await supabase
    .from("runs")
    .select("id, completed_at")
    .or(filter);

  const runs = runData ?? [];
  if (runs.length === 0) return { correct: 0, quizzes: 0 };

  const { count } = await supabase
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("is_correct", true)
    .in(
      "run_id",
      runs.map((run) => run.id),
    );

  return {
    correct: count ?? 0,
    quizzes: runs.filter((run) => run.completed_at !== null).length,
  };
}
