import { NextResponse, type NextRequest } from "next/server";
import { XP_PER_CORRECT, XP_PER_QUIZ } from "@/lib/progression/mastery";
import { submitAnswerInput } from "@/lib/schemas";
import { errorResponse, loadRun, updateRun } from "@/lib/runs";
import { createServiceClient } from "@/lib/supabase/service";
import type { QuestionOption } from "@/lib/types";

/**
 * POST /api/runs/:runId/answers -- score one answer.
 *
 * No model call. This route is a comparison and two writes, which is the whole
 * reason multiple choice was the right call for a 24-hour build: the free-text
 * design put an 8-second model call between every question and the next
 * screen, five times per quiz, each one a chance to time out on stage.
 *
 * Idempotent per (run_id, question_id): a resubmission returns the existing
 * answer rather than re-scoring, so a double-tap or a refresh cannot drain
 * hearts.
 *
 * Request:  { questionId, selectedIndex }
 * Response: { isCorrect, correctIndex, explanations, heartsRemaining, streak,
 *             xpAwarded, runComplete, outOfHearts }
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  try {
    const body = await request.json().catch(() => null);
    const parsed = submitAnswerInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Malformed answer." }, { status: 400 });
    }
    const { questionId, selectedIndex } = parsed.data;

    const run = await loadRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    const supabase = createServiceClient();

    const { data: question } = await supabase
      .from("questions")
      .select("id, run_id, order_index, options, correct_index")
      .eq("id", questionId)
      .eq("run_id", runId)
      .maybeSingle();

    if (!question) {
      return NextResponse.json(
        { error: "That question is not part of this run." },
        { status: 404 },
      );
    }

    const options = question.options as QuestionOption[];
    const correctIndex = question.correct_index as number;
    const explanations = options.map((option) => ({
      label: option.label,
      explanation: option.explanation,
      citation: option.verified ? option.citation : null,
      verified: option.verified,
    }));

    // Idempotency: replay the stored result rather than scoring again.
    const { data: existing } = await supabase
      .from("answers")
      .select("selected_index, is_correct, streak_at_answer")
      .eq("run_id", runId)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        isCorrect: existing.is_correct,
        correctIndex,
        explanations,
        heartsRemaining: run.hearts_remaining,
        streak: existing.streak_at_answer,
        xpAwarded: 0,
        runComplete: run.completed_at !== null,
        outOfHearts: run.hearts_remaining <= 0,
        replayed: true,
      });
    }

    const isCorrect = selectedIndex === correctIndex;

    // The in-run streak comes from this run's answers in order -- it is not a
    // stored counter, so it cannot drift from the answers it describes.
    const { data: priorAnswers } = await supabase
      .from("answers")
      .select("is_correct, questions!inner(order_index)")
      .eq("run_id", runId)
      .order("answered_at", { ascending: true });

    const priorStreak = (priorAnswers ?? []).reduce(
      (streak, row) => (row.is_correct ? streak + 1 : 0),
      0,
    );
    const streak = isCorrect ? priorStreak + 1 : 0;

    const { error: insertError } = await supabase.from("answers").insert({
      run_id: runId,
      question_id: questionId,
      selected_index: selectedIndex,
      is_correct: isCorrect,
      streak_at_answer: streak,
    });

    if (insertError) {
      // Unique violation: another request beat us to it. Treat as a replay.
      if (insertError.code === "23505") {
        return NextResponse.json({
          isCorrect,
          correctIndex,
          explanations,
          heartsRemaining: run.hearts_remaining,
          streak,
          xpAwarded: 0,
          runComplete: run.completed_at !== null,
          outOfHearts: run.hearts_remaining <= 0,
          replayed: true,
        });
      }
      throw new Error(`Could not record the answer: ${insertError.message}`);
    }

    const heartsRemaining = isCorrect
      ? run.hearts_remaining
      : Math.max(0, run.hearts_remaining - 1);

    const { count: answeredCount } = await supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId);

    // At zero hearts the run ends early and reports on what was answered --
    // a short run, not a lost one.
    const outOfHearts = heartsRemaining <= 0;
    const lastQuestion = (answeredCount ?? 0) >= run.question_count;
    const runComplete = outOfHearts || lastQuestion;

    await updateRun(runId, {
      hearts_remaining: heartsRemaining,
      ...(runComplete && !run.completed_at
        ? { status: "complete" as const, completed_at: new Date().toISOString() }
        : {}),
    });

    return NextResponse.json({
      isCorrect,
      correctIndex,
      explanations,
      heartsRemaining,
      streak,
      xpAwarded:
        (isCorrect ? XP_PER_CORRECT : 0) + (runComplete ? XP_PER_QUIZ : 0),
      runComplete,
      outOfHearts,
      replayed: false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
