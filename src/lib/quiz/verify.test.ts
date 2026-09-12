import { describe, expect, it } from "vitest";
import {
  MAX_CITATION_SPAN_LINES,
  verifyCitation,
  type RetrievedSpan,
  type SnapshotFiles,
} from "@/lib/quiz/verify";

/**
 * Citation verification -- all four rejection rules.
 *
 * This is the piece that makes the product's central claim true: a model
 * cannot fabricate evidence even when it fabricates prose. Each rule gets its
 * own rejection case, plus the boundaries where a rule starts and stops
 * applying.
 */

const files: SnapshotFiles = new Map([
  ["src/index.ts", 120],
  ["README.md", 40],
  ["src/lib/auth.ts", 300],
]);

const retrieved: RetrievedSpan[] = [
  { filePath: "src/index.ts", startLine: 1, endLine: 60 },
  { filePath: "src/index.ts", startLine: 51, endLine: 110 },
  { filePath: "README.md", startLine: 1, endLine: 40 },
];

const check = (
  path: string,
  startLine: number,
  endLine: number,
  spans: RetrievedSpan[] = retrieved,
) => verifyCitation({ path, startLine, endLine }, files, spans);

describe("rule 1 -- the path must be in the snapshot", () => {
  it("accepts a path that was ingested", () => {
    expect(check("src/index.ts", 10, 20)).toEqual({ ok: true });
  });

  it("rejects a path the model invented", () => {
    expect(check("src/does-not-exist.ts", 1, 5)).toEqual({
      ok: false,
      reason: "unknown_path",
    });
  });

  it("rejects a real repository path that was excluded from the snapshot", () => {
    // Present in the repo, filtered out at ingestion, so it is not in the
    // manifest -- there is nothing to verify a line range against.
    expect(check("node_modules/react/index.js", 1, 5)).toEqual({
      ok: false,
      reason: "unknown_path",
    });
  });

  it("is exact about paths, not fuzzy", () => {
    expect(check("index.ts", 1, 5).ok).toBe(false);
    expect(check("./src/index.ts", 1, 5).ok).toBe(false);
    expect(check("src/Index.ts", 1, 5).ok).toBe(false);
  });
});

describe("rule 2 -- the line range must exist in that file", () => {
  it("accepts a range inside the file", () => {
    expect(check("README.md", 1, 40)).toEqual({ ok: true });
  });

  it("rejects a range running past the end of the file", () => {
    expect(check("README.md", 30, 41)).toEqual({
      ok: false,
      reason: "out_of_bounds",
    });
  });

  it("rejects line 0 and negative lines", () => {
    expect(check("src/index.ts", 0, 10)).toEqual({
      ok: false,
      reason: "out_of_bounds",
    });
    expect(check("src/index.ts", -5, 10)).toEqual({
      ok: false,
      reason: "out_of_bounds",
    });
  });

  it("rejects an inverted range", () => {
    expect(check("src/index.ts", 40, 20)).toEqual({
      ok: false,
      reason: "out_of_bounds",
    });
  });

  it("rejects non-integer line numbers", () => {
    expect(check("src/index.ts", 1.5, 10)).toEqual({
      ok: false,
      reason: "out_of_bounds",
    });
    expect(check("src/index.ts", 1, Number.NaN)).toEqual({
      ok: false,
      reason: "out_of_bounds",
    });
  });

  it("accepts a single-line citation", () => {
    expect(check("src/index.ts", 42, 42)).toEqual({ ok: true });
  });

  it("accepts the exact last line of the file", () => {
    expect(check("README.md", 40, 40)).toEqual({ ok: true });
  });
});

describe("rule 3 -- the span must overlap source the model was shown", () => {
  it("rejects a real range in a real file that was never retrieved", () => {
    // The subtle failure this rule exists for: a plausible citation into a
    // file the model knows about but never actually read.
    expect(check("src/lib/auth.ts", 10, 20)).toEqual({
      ok: false,
      reason: "not_retrieved",
    });
  });

  it("rejects a range in a retrieved file that falls outside every chunk", () => {
    // src/index.ts was retrieved, but only lines 1-110.
    expect(check("src/index.ts", 111, 120)).toEqual({
      ok: false,
      reason: "not_retrieved",
    });
  });

  it("accepts a span that partially overlaps a retrieved chunk", () => {
    expect(check("src/index.ts", 105, 115)).toEqual({ ok: true });
  });

  it("accepts a span touching only the first line of a chunk", () => {
    expect(check("src/index.ts", 1, 1)).toEqual({ ok: true });
  });

  it("accepts a span touching only the last line of a chunk", () => {
    expect(check("src/index.ts", 110, 110)).toEqual({ ok: true });
  });

  it("rejects everything when nothing was retrieved", () => {
    expect(check("src/index.ts", 10, 20, [])).toEqual({
      ok: false,
      reason: "not_retrieved",
    });
  });

  it("does not let a chunk from one file vouch for another", () => {
    const spans: RetrievedSpan[] = [
      { filePath: "README.md", startLine: 1, endLine: 40 },
    ];
    expect(check("src/index.ts", 10, 20, spans)).toEqual({
      ok: false,
      reason: "not_retrieved",
    });
  });
});

describe("rule 4 -- the span must be narrow enough to be evidence", () => {
  it("rejects a span at the width limit", () => {
    const spans: RetrievedSpan[] = [
      { filePath: "src/lib/auth.ts", startLine: 1, endLine: 300 },
    ];
    expect(check("src/lib/auth.ts", 1, MAX_CITATION_SPAN_LINES, spans)).toEqual({
      ok: false,
      reason: "span_too_wide",
    });
  });

  it("accepts a span one line under the limit", () => {
    const spans: RetrievedSpan[] = [
      { filePath: "src/lib/auth.ts", startLine: 1, endLine: 300 },
    ];
    expect(
      check("src/lib/auth.ts", 1, MAX_CITATION_SPAN_LINES - 1, spans),
    ).toEqual({ ok: true });
  });

  it("rejects a whole-file citation even when the whole file was retrieved", () => {
    // "The answer is somewhere in this 300-line file" is not evidence.
    const spans: RetrievedSpan[] = [
      { filePath: "src/lib/auth.ts", startLine: 1, endLine: 300 },
    ];
    expect(check("src/lib/auth.ts", 1, 300, spans)).toEqual({
      ok: false,
      reason: "span_too_wide",
    });
  });

  it("reports width before retrieval when a citation breaks both rules", () => {
    // Width is the more useful thing to tell the model on a regeneration.
    expect(check("src/lib/auth.ts", 1, 200)).toEqual({
      ok: false,
      reason: "span_too_wide",
    });
  });
});

describe("rule precedence", () => {
  it("reports an unknown path before anything else", () => {
    expect(check("nope.ts", 0, 9999)).toEqual({
      ok: false,
      reason: "unknown_path",
    });
  });

  it("reports bounds before width", () => {
    expect(check("README.md", 1, 500)).toEqual({
      ok: false,
      reason: "out_of_bounds",
    });
  });
});
