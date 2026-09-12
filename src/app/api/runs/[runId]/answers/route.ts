import { NextResponse } from "next/server";

/**
 * POST /api/runs/:runId/answers — score one answer.
 *
 * Not implemented yet. No model call: this is a comparison against the stored
 * correct_index plus two writes. Idempotent per (run_id, question_id) so a
 * double-tap or refresh cannot drain hearts.
 *
 * Request:  { questionId, selectedIndex }
 * Response: { isCorrect, correctIndex, explanations, heartsRemaining, streak, xpAwarded }
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented: answer scoring (Feature 5)." },
    { status: 501 },
  );
}
