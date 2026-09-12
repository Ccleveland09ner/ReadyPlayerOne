/**
 * Citation verification -- a pure function. No model, no network, no database.
 *
 * This is the differentiator, so it is the piece that gets real tests. It runs
 * at GENERATION time rather than grading time, which means a bad citation
 * never reaches a player at all.
 *
 * A citation survives only if all four hold:
 *   1. `path` exists in the snapshot manifest with included = true
 *   2. 1 <= startLine <= endLine <= line_count for that file
 *   3. the span overlaps a chunk that was in the retrieval set for that
 *      question -- the model cannot cite source it was never shown
 *   4. the span is under 80 lines, so "the whole file" cannot pose as evidence
 *
 * Rule 3 is the one that actually stops fabrication. Rules 1 and 2 catch a
 * model inventing a path or running off the end of a file; rule 3 catches the
 * subtler failure where it cites a real file it never read, guessing that the
 * answer is probably in there somewhere.
 */

import type { Citation } from "@/lib/types";

/** A span at or above this many lines is too coarse to count as evidence. */
export const MAX_CITATION_SPAN_LINES = 80;

export type VerificationFailure =
  | "unknown_path"
  | "out_of_bounds"
  | "not_retrieved"
  | "span_too_wide";

export type VerificationResult =
  | { ok: true }
  | { ok: false; reason: VerificationFailure };

/** The snapshot manifest, as `path -> line count`. */
export type SnapshotFiles = Map<string, number>;

/** The chunks that were shown to the model for this question. */
export type RetrievedSpan = {
  filePath: string;
  startLine: number;
  endLine: number;
};

export function verifyCitation(
  citation: Citation,
  snapshotFiles: SnapshotFiles,
  retrieved: RetrievedSpan[],
): VerificationResult {
  const lineCount = snapshotFiles.get(citation.path);

  // 1. The path is in the snapshot and was actually ingested.
  if (lineCount === undefined) {
    return { ok: false, reason: "unknown_path" };
  }

  // 2. The range is real. Non-integers and inverted ranges fail here too.
  const { startLine, endLine } = citation;
  if (
    !Number.isInteger(startLine) ||
    !Number.isInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine ||
    endLine > lineCount
  ) {
    return { ok: false, reason: "out_of_bounds" };
  }

  // 4. Checked before rule 3: a too-wide span may well overlap something, and
  //    "you cited the whole file" is the more useful reason to report.
  if (endLine - startLine + 1 >= MAX_CITATION_SPAN_LINES) {
    return { ok: false, reason: "span_too_wide" };
  }

  // 3. The span overlaps source the model was actually shown.
  const overlapsRetrieved = retrieved.some(
    (span) =>
      span.filePath === citation.path &&
      startLine <= span.endLine &&
      endLine >= span.startLine,
  );
  if (!overlapsRetrieved) {
    return { ok: false, reason: "not_retrieved" };
  }

  return { ok: true };
}

/** Human-readable reason, for the per-run counter of rejected citations. */
export function describeFailure(reason: VerificationFailure): string {
  switch (reason) {
    case "unknown_path":
      return "cited a file that is not in the ingested snapshot";
    case "out_of_bounds":
      return "cited a line range that does not exist in that file";
    case "not_retrieved":
      return "cited source that was never retrieved for this question";
    case "span_too_wide":
      return `cited ${MAX_CITATION_SPAN_LINES}+ lines, which is too coarse to be evidence`;
  }
}
