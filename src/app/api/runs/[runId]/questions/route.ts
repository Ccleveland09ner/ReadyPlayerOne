import { NextResponse } from "next/server";

/**
 * POST /api/runs/:runId/questions — generate the five questions.
 *
 * Not implemented yet. One structured model call per quiz: five questions, one
 * per topic, four options each, one correct, an explanation and a citation per
 * option. Retrieval is per-topic (five fixed probe queries), not global.
 *
 * Every citation is verified before the questions are stored. If the correct
 * option loses its citation, the question is regenerated once and then the run
 * fails — nothing ships an uncited answer key.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented: question generation (Feature 3)." },
    { status: 501 },
  );
}
