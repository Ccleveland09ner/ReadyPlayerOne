import { describe, expect, it } from "vitest";
import {
  CHUNK_OVERLAP_LINES,
  CHUNK_WINDOW_LINES,
  WHOLE_FILE_UNDER_LINES,
  chunkFile,
  countLines,
  splitLines,
} from "@/lib/index/chunk";

/**
 * The chunker's line arithmetic.
 *
 * Every citation in the product is a claim about line numbers. If a chunk says
 * 61-120 and the file disagrees, the product is confidently wrong -- which is
 * worse than being unable to answer. So the invariant below is checked against
 * the source for every case, not just asserted on a couple of happy paths.
 */

/** Rebuilds a chunk's span from the source and compares it to the chunk. */
function assertSpansMatchSource(text: string, filePath = "src/example.ts") {
  const lines = splitLines(text);
  for (const chunk of chunkFile(filePath, text)) {
    expect(chunk.startLine).toBeGreaterThanOrEqual(1);
    expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
    expect(chunk.endLine).toBeLessThanOrEqual(lines.length);

    const fromSource = lines.slice(chunk.startLine - 1, chunk.endLine).join("\n");
    expect(chunk.content).toBe(fromSource);
  }
}

const numbered = (count: number, eol = "\n") =>
  Array.from({ length: count }, (_, i) => `line ${i + 1}`).join(eol);

describe("splitLines", () => {
  it("counts a file with no trailing newline", () => {
    expect(splitLines("a\nb\nc")).toEqual(["a", "b", "c"]);
  });

  it("does not invent a line for a trailing newline", () => {
    // A 3-line file ending in "\n" has 3 lines, which is what a code host
    // shows and therefore what a citation must agree with.
    expect(splitLines("a\nb\nc\n")).toEqual(["a", "b", "c"]);
    expect(countLines("a\nb\nc\n")).toBe(3);
  });

  it("keeps interior blank lines", () => {
    expect(splitLines("a\n\nc")).toEqual(["a", "", "c"]);
  });

  it("keeps a deliberate blank final line when the file ends in two newlines", () => {
    expect(splitLines("a\nb\n\n")).toEqual(["a", "b", ""]);
  });

  it("normalizes CRLF to the same line count as LF", () => {
    expect(splitLines("a\r\nb\r\nc")).toEqual(["a", "b", "c"]);
    expect(countLines("a\r\nb\r\nc\r\n")).toBe(3);
    expect(countLines(numbered(120, "\r\n"))).toBe(countLines(numbered(120)));
  });

  it("normalizes lone CR (classic Mac) line endings", () => {
    expect(splitLines("a\rb\rc")).toEqual(["a", "b", "c"]);
  });

  it("treats an empty file as a single empty line", () => {
    expect(splitLines("")).toEqual([""]);
  });
});

describe("chunkFile", () => {
  it("returns nothing for an empty file", () => {
    expect(chunkFile("empty.ts", "")).toEqual([]);
  });

  it("emits one chunk covering the whole of a short file", () => {
    const text = numbered(12);
    const chunks = chunkFile("short.ts", text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[0].endLine).toBe(12);
    expect(chunks[0].content).toBe(text);
  });

  it("handles a one-line file", () => {
    const chunks = chunkFile("one.ts", "just the one line");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ startLine: 1, endLine: 1 });
  });

  it("still emits one chunk at exactly the whole-file threshold", () => {
    const chunks = chunkFile("edge.ts", numbered(WHOLE_FILE_UNDER_LINES));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].endLine).toBe(WHOLE_FILE_UNDER_LINES);
  });

  it("windows a longer file with the documented overlap", () => {
    const chunks = chunkFile("long.ts", numbered(150));
    const stride = CHUNK_WINDOW_LINES - CHUNK_OVERLAP_LINES;

    expect(chunks[0]).toMatchObject({ startLine: 1, endLine: 60 });
    expect(chunks[1]).toMatchObject({ startLine: 1 + stride, endLine: 110 });
    expect(chunks[2]).toMatchObject({ startLine: 1 + 2 * stride, endLine: 150 });

    // Consecutive windows overlap by exactly CHUNK_OVERLAP_LINES.
    for (let i = 1; i < chunks.length; i++) {
      const overlap = chunks[i - 1].endLine - chunks[i].startLine + 1;
      if (chunks[i - 1].endLine < 150) {
        expect(overlap).toBe(CHUNK_OVERLAP_LINES);
      }
    }
  });

  it("clamps the final window to the last line instead of padding", () => {
    const chunks = chunkFile("ragged.ts", numbered(65));
    const last = chunks[chunks.length - 1];
    expect(last.endLine).toBe(65);
  });

  it("does not emit a window past the end of the file", () => {
    // 61 lines: the first window covers 1-60, and the second must not run off
    // the end or duplicate a range already emitted.
    const chunks = chunkFile("just-over.ts", numbered(61));
    expect(chunks[chunks.length - 1].endLine).toBe(61);
    expect(new Set(chunks.map((c) => `${c.startLine}-${c.endLine}`)).size).toBe(
      chunks.length,
    );
  });

  it("covers every line of the file across its chunks", () => {
    const chunks = chunkFile("cover.ts", numbered(200));
    const covered = new Set<number>();
    for (const chunk of chunks) {
      for (let line = chunk.startLine; line <= chunk.endLine; line++) {
        covered.add(line);
      }
    }
    expect(covered.size).toBe(200);
  });

  it("produces spans that match the source exactly", () => {
    assertSpansMatchSource(numbered(7));
    assertSpansMatchSource(numbered(40));
    assertSpansMatchSource(numbered(61));
    assertSpansMatchSource(numbered(150));
    assertSpansMatchSource(numbered(150, "\r\n"));
    assertSpansMatchSource(`${numbered(150)}\n`);
    assertSpansMatchSource("a\n\n\nb\n\n\nc");
  });

  it("gives CRLF and LF copies of one file identical spans", () => {
    const lf = chunkFile("x.ts", numbered(150));
    const crlf = chunkFile("x.ts", numbered(150, "\r\n"));

    expect(crlf.map((c) => [c.startLine, c.endLine])).toEqual(
      lf.map((c) => [c.startLine, c.endLine]),
    );
    // Content is normalized to LF, so the chunks are byte-identical too.
    expect(crlf.map((c) => c.content)).toEqual(lf.map((c) => c.content));
  });

  it("is unaffected by a trailing newline", () => {
    const without = chunkFile("x.ts", numbered(100));
    const with_ = chunkFile("x.ts", `${numbered(100)}\n`);
    expect(with_).toEqual(without);
  });
});
