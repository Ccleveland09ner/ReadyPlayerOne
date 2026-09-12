import { describe, expect, it } from "vitest";
import { selectFiles, type TreeEntry } from "@/lib/github";
import { chunkFile, countLines } from "@/lib/index/chunk";
import {
  verifyCitation,
  type RetrievedSpan,
  type SnapshotFiles,
} from "@/lib/quiz/verify";

/**
 * Integration: a fixture repository through filter -> chunk -> verify.
 *
 * No network, no database, no model. This is the test the tech design asks
 * for, and its job is to prove the seam between the stages holds: that the
 * chunks produced from the files that survived filtering are exactly the
 * chunks a citation can be verified against.
 *
 * The bug it exists to catch is the one that would be invisible in unit tests
 * and fatal in production -- chunk line numbers drifting from the source they
 * came from, so citations point at the wrong lines while everything still
 * "works".
 */

// --- a small fixture repository ---------------------------------------------

const line = (n: number) => `const value${n} = ${n};`;
const body = (count: number, eol = "\n") =>
  Array.from({ length: count }, (_, i) => line(i + 1)).join(eol);

const FIXTURE: Record<string, string> = {
  "README.md": "# Fixture\n\nA small repository used by the pipeline test.\n",
  "package.json": JSON.stringify(
    { name: "fixture", scripts: { dev: "next dev" }, dependencies: { next: "16" } },
    null,
    2,
  ),
  "src/index.ts": body(150),
  "src/lib/auth.ts": body(61),
  // CRLF on purpose: a Windows checkout must produce the same line numbers.
  "src/lib/util.ts": body(45, "\r\n"),
  "src/short.ts": body(12),
  ".github/workflows/deploy.yml": "name: deploy\non: push\n",
  // These must not survive filtering.
  "node_modules/react/index.js": body(200),
  "package-lock.json": body(500),
  "dist/bundle.min.js": body(300),
  "logo.png": "binary",
};

function treeOf(files: Record<string, string>): TreeEntry[] {
  return Object.entries(files).map(([path, content]) => ({
    path,
    size: Buffer.byteLength(content, "utf8"),
  }));
}

/** Runs the real ingestion stages over the fixture. */
function ingest(files: Record<string, string>) {
  const selected = selectFiles(treeOf(files));
  const included = selected.filter((file) => file.included);

  const snapshotFiles: SnapshotFiles = new Map();
  const chunks: { filePath: string; startLine: number; endLine: number; content: string }[] =
    [];

  for (const file of included) {
    const text = files[file.path];
    snapshotFiles.set(file.path, countLines(text));
    chunks.push(...chunkFile(file.path, text));
  }

  return { selected, included, snapshotFiles, chunks };
}

const retrievedFrom = (
  chunks: { filePath: string; startLine: number; endLine: number }[],
): RetrievedSpan[] =>
  chunks.map((chunk) => ({
    filePath: chunk.filePath,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
  }));

// --- the test ---------------------------------------------------------------

describe("ingestion -> indexing -> verification", () => {
  const { selected, included, snapshotFiles, chunks } = ingest(FIXTURE);

  it("keeps source and drops dependencies, lockfiles, bundles and binaries", () => {
    const includedPaths = included.map((f) => f.path).sort();

    expect(includedPaths).toContain("README.md");
    expect(includedPaths).toContain("src/index.ts");
    expect(includedPaths).toContain("src/lib/util.ts");

    expect(includedPaths).not.toContain("node_modules/react/index.js");
    expect(includedPaths).not.toContain("package-lock.json");
    expect(includedPaths).not.toContain("dist/bundle.min.js");
    expect(includedPaths).not.toContain("logo.png");
  });

  it("accounts for every file in the tree", () => {
    expect(selected).toHaveLength(Object.keys(FIXTURE).length);
  });

  it("produces chunks only for files in the snapshot manifest", () => {
    for (const chunk of chunks) {
      expect(snapshotFiles.has(chunk.filePath)).toBe(true);
    }
  });

  it("keeps every chunk inside its file's real line count", () => {
    for (const chunk of chunks) {
      const lineCount = snapshotFiles.get(chunk.filePath)!;
      expect(chunk.startLine).toBeGreaterThanOrEqual(1);
      expect(chunk.endLine).toBeLessThanOrEqual(lineCount);
    }
  });

  it("reproduces the source exactly from each chunk's line range", () => {
    // The load-bearing invariant of the whole product.
    for (const chunk of chunks) {
      const source = FIXTURE[chunk.filePath]
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
      const lines = source.split("\n");
      if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();

      expect(chunk.content).toBe(
        lines.slice(chunk.startLine - 1, chunk.endLine).join("\n"),
      );
    }
  });

  it("accepts a citation into retrieved source", () => {
    const chunk = chunks.find((c) => c.filePath === "src/index.ts")!;
    expect(
      verifyCitation(
        {
          path: "src/index.ts",
          startLine: chunk.startLine,
          endLine: chunk.startLine + 5,
        },
        snapshotFiles,
        retrievedFrom(chunks),
      ),
    ).toEqual({ ok: true });
  });

  it("rejects a citation into a file the filter excluded", () => {
    // The model saw "node_modules" in no excerpt, but a plausible guess about
    // a real repository would name it anyway.
    expect(
      verifyCitation(
        { path: "node_modules/react/index.js", startLine: 1, endLine: 10 },
        snapshotFiles,
        retrievedFrom(chunks),
      ),
    ).toEqual({ ok: false, reason: "unknown_path" });
  });

  it("rejects a citation past the end of a real file", () => {
    const lineCount = snapshotFiles.get("src/short.ts")!;
    expect(
      verifyCitation(
        { path: "src/short.ts", startLine: lineCount, endLine: lineCount + 5 },
        snapshotFiles,
        retrievedFrom(chunks),
      ),
    ).toEqual({ ok: false, reason: "out_of_bounds" });
  });

  it("rejects a citation into a file that was never retrieved", () => {
    const onlyIndex = retrievedFrom(
      chunks.filter((c) => c.filePath === "src/index.ts"),
    );
    expect(
      verifyCitation(
        { path: "src/lib/auth.ts", startLine: 1, endLine: 10 },
        snapshotFiles,
        onlyIndex,
      ),
    ).toEqual({ ok: false, reason: "not_retrieved" });
  });

  it("rejects a whole-file citation as too coarse", () => {
    expect(
      verifyCitation(
        { path: "src/index.ts", startLine: 1, endLine: 150 },
        snapshotFiles,
        retrievedFrom(chunks),
      ),
    ).toEqual({ ok: false, reason: "span_too_wide" });
  });

  it("gives a CRLF file the same line numbers as its LF twin", () => {
    const crlf = ingest({ "a.ts": body(80, "\r\n") });
    const lf = ingest({ "a.ts": body(80) });

    expect(crlf.snapshotFiles.get("a.ts")).toBe(lf.snapshotFiles.get("a.ts"));
    expect(crlf.chunks.map((c) => [c.startLine, c.endLine])).toEqual(
      lf.chunks.map((c) => [c.startLine, c.endLine]),
    );
  });

  it("verifies citations identically for a CRLF checkout", () => {
    const crlf = ingest({ "a.ts": body(80, "\r\n") });
    expect(
      verifyCitation(
        { path: "a.ts", startLine: 70, endLine: 75 },
        crlf.snapshotFiles,
        retrievedFrom(crlf.chunks),
      ),
    ).toEqual({ ok: true });
  });

  it("fails a repository with too little source rather than quizzing on it", () => {
    const tiny = ingest({
      "README.md": "# tiny\n",
      "node_modules/x/index.js": body(50),
      "package-lock.json": body(200),
    });
    expect(tiny.included.length).toBeLessThan(5);
  });
});
