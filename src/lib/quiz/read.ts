import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { loadRun, type RunRecord } from "@/lib/runs";
import { isSupabaseConfigured } from "@/lib/env";
import type { Citation, QuestionOption, Topic } from "@/lib/types";

/**
 * Server-side reads for the quiz screens.
 *
 * `loadQuizForPlay` deliberately strips `correct_index` and every explanation
 * before the data reaches the browser. The answer route returns them on
 * submit instead, so the answer key is never sitting in the page payload
 * waiting to be read out of the network tab.
 */

export type PlayableOption = {
  label: string;
  text: string;
};

export type PlayableQuestion = {
  id: string;
  orderIndex: number;
  topic: Topic;
  prompt: string;
  options: PlayableOption[];
};

export type PlayableQuiz = {
  run: RunRecord;
  questions: PlayableQuestion[];
  /** Index of the first unanswered question, for resume-after-refresh. */
  resumeAt: number;
  answeredCount: number;
  streak: number;
};

type QuestionRow = {
  id: string;
  order_index: number;
  topic: Topic;
  prompt: string;
  options: QuestionOption[];
  correct_index: number;
};

export async function loadQuizForPlay(
  runId: string,
): Promise<PlayableQuiz | null> {
  const run = await loadRun(runId);
  if (!run) return null;

  const supabase = createServiceClient();

  const { data: questionData } = await supabase
    .from("questions")
    .select("id, order_index, topic, prompt, options, correct_index")
    .eq("run_id", runId)
    .order("order_index");

  const questions = (questionData ?? []) as QuestionRow[];

  const { data: answerData } = await supabase
    .from("answers")
    .select("question_id, is_correct, answered_at")
    .eq("run_id", runId)
    .order("answered_at", { ascending: true });

  const answers = answerData ?? [];
  const answeredIds = new Set(answers.map((a) => a.question_id));
  const firstUnanswered = questions.findIndex((q) => !answeredIds.has(q.id));

  const streak = answers.reduce(
    (running, answer) => (answer.is_correct ? running + 1 : 0),
    0,
  );

  return {
    run,
    questions: questions.map((question) => ({
      id: question.id,
      orderIndex: question.order_index,
      topic: question.topic,
      prompt: question.prompt,
      // No correct index, no explanations, no citations.
      options: question.options.map((option) => ({
        label: option.label,
        text: option.text,
      })),
    })),
    resumeAt: firstUnanswered === -1 ? Math.max(0, questions.length - 1) : firstUnanswered,
    answeredCount: answers.length,
    streak,
  };
}

export type ResultSummary = {
  run: RunRecord;
  score: number;
  total: number;
  breakdown: boolean[];
  topicsPassed: Record<string, boolean>;
};

export async function loadResults(runId: string): Promise<ResultSummary | null> {
  const run = await loadRun(runId);
  if (!run) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("questions")
    .select("id, order_index, topic, answers(is_correct)")
    .eq("run_id", runId)
    .order("order_index");

  type Joined = {
    id: string;
    order_index: number;
    topic: Topic;
    answers: { is_correct: boolean }[] | { is_correct: boolean } | null;
  };

  const rows = (data ?? []) as Joined[];
  const breakdown: boolean[] = [];
  const topicsPassed: Record<string, boolean> = {};

  for (const row of rows) {
    const answer = Array.isArray(row.answers) ? row.answers[0] : row.answers;
    const correct = answer?.is_correct === true;
    breakdown.push(correct);
    topicsPassed[row.topic] = correct;
  }

  return {
    run,
    score: breakdown.filter(Boolean).length,
    total: run.question_count,
    breakdown,
    topicsPassed,
  };
}

export type ReviewOption = QuestionOption & { citation: Citation | null };

export type ReviewQuestion = {
  id: string;
  orderIndex: number;
  topic: Topic;
  prompt: string;
  options: ReviewOption[];
  correctIndex: number;
  selectedIndex: number | null;
  isCorrect: boolean;
};

export type Review = {
  run: RunRecord;
  questions: ReviewQuestion[];
};

/** Answer Review: everything, including the citations that survived. */
export async function loadReview(runId: string): Promise<Review | null> {
  const run = await loadRun(runId);
  if (!run) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("questions")
    .select(
      "id, order_index, topic, prompt, options, correct_index, answers(selected_index, is_correct)",
    )
    .eq("run_id", runId)
    .order("order_index");

  type Joined = QuestionRow & {
    answers:
      | { selected_index: number | null; is_correct: boolean }[]
      | { selected_index: number | null; is_correct: boolean }
      | null;
  };

  const questions = ((data ?? []) as Joined[]).map((row) => {
    const answer = Array.isArray(row.answers) ? row.answers[0] : row.answers;
    return {
      id: row.id,
      orderIndex: row.order_index,
      topic: row.topic,
      prompt: row.prompt,
      options: row.options.map((option) => ({
        ...option,
        citation: option.verified ? option.citation : null,
      })),
      correctIndex: row.correct_index,
      selectedIndex: answer?.selected_index ?? null,
      isCorrect: answer?.is_correct === true,
    };
  });

  return { run, questions };
}

/** Repos this player has run, for the top-bar selector. */
export async function recentRepos(
  anonId: string | null,
  userId: string | null,
): Promise<{ owner: string; repo: string; runId: string }[]> {
  const clauses: string[] = [];
  if (anonId) clauses.push(`anon_id.eq.${anonId}`);
  if (userId) clauses.push(`user_id.eq.${userId}`);
  if (clauses.length === 0 || !isSupabaseConfigured()) return [];

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("runs")
    .select("id, owner, repo, created_at")
    .or(clauses.join(","))
    .order("created_at", { ascending: false })
    .limit(20);

  const seen = new Set<string>();
  const repos: { owner: string; repo: string; runId: string }[] = [];

  for (const row of data ?? []) {
    const key = `${row.owner}/${row.repo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    repos.push({ owner: row.owner, repo: row.repo, runId: row.id });
    if (repos.length >= 5) break;
  }

  return repos;
}
