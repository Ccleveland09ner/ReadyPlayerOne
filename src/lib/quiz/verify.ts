import type { Citation } from "@/lib/types";

/**
 * Citation verification — a pure function, no model, no network.
 *
 * Not implemented yet (Feature 5). This is the differentiator, so it is the
 * one piece that gets real tests. It runs at generation time, which means a
 * bad citation never reaches a player at all.
 *
 * A citation survives only if all four hold:
 *   1. path exists in repo_files for the effective snapshot with included=true
 *   2. 1 <= startLine <= endLine <= line_count for that file
 *   3. the span overlaps a chunk that was in the retrieval set for the
 *      question — the model cannot cite source it was never shown
 *   4. the span is under 80 lines, so the whole file cannot pose as evidence
 */

export const MAX_CITATION_SPAN_LINES = 80;

export type VerificationFailure =
  | "unknown_path"
  | "out_of_bounds"
  | "not_retrieved"
  | "span_too_wide";

export type VerificationResult =
  | { ok: true }
  | { ok: false; reason: VerificationFailure };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function verifyCitation(_citation: Citation): VerificationResult {
  throw new Error("Not implemented: verifyCitation");
}
