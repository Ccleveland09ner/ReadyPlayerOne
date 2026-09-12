import { describe, expect, it } from "vitest";
import {
  MAX_FILES,
  MAX_TOTAL_BYTES,
  parseRepoUrl,
  selectFiles,
  skipReasonFor,
  type TreeEntry,
} from "@/lib/github";

/**
 * URL parsing and file filtering.
 *
 * These decide what a snapshot *is*, and the snapshot is what the citation
 * verifier checks paths against. A file wrongly excluded means a citation into
 * it gets rejected as `unknown_path`; a file wrongly included means the caps
 * stop meaning anything.
 */

describe("parseRepoUrl", () => {
  it("accepts the shorthand", () => {
    expect(parseRepoUrl("vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("accepts a full https URL", () => {
    expect(parseRepoUrl("https://github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("tolerates the noise people actually paste", () => {
    const expected = { owner: "vercel", repo: "next.js" };
    expect(parseRepoUrl("https://github.com/vercel/next.js/")).toEqual(expected);
    expect(parseRepoUrl("https://github.com/vercel/next.js.git")).toEqual(expected);
    expect(parseRepoUrl("  https://github.com/vercel/next.js  ")).toEqual(expected);
    expect(parseRepoUrl("http://github.com/vercel/next.js")).toEqual(expected);
    expect(parseRepoUrl("https://www.github.com/vercel/next.js")).toEqual(expected);
    expect(parseRepoUrl("github.com/vercel/next.js")).toEqual(expected);
    expect(parseRepoUrl("git@github.com:vercel/next.js.git")).toEqual(expected);
  });

  it("keeps the repo when the URL points deeper into it", () => {
    expect(parseRepoUrl("https://github.com/vercel/next.js/tree/main/packages")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("rejects hosts that are not GitHub", () => {
    expect(parseRepoUrl("https://gitlab.com/foo/bar")).toBeNull();
    expect(parseRepoUrl("https://bitbucket.org/foo/bar")).toBeNull();
    // Lookalike hostnames are the reason this is an equality check.
    expect(parseRepoUrl("https://github.com.evil.tld/foo/bar")).toBeNull();
    expect(parseRepoUrl("https://notgithub.com/foo/bar")).toBeNull();
  });

  it("rejects incomplete or malformed input", () => {
    expect(parseRepoUrl("")).toBeNull();
    expect(parseRepoUrl("   ")).toBeNull();
    expect(parseRepoUrl("vercel")).toBeNull();
    expect(parseRepoUrl("https://github.com/vercel")).toBeNull();
    expect(parseRepoUrl("not a url at all")).toBeNull();
    expect(parseRepoUrl("../../etc/passwd")).toBeNull();
  });
});

describe("skipReasonFor", () => {
  const entry = (path: string, size = 1000): TreeEntry => ({ path, size });

  it("keeps ordinary source", () => {
    expect(skipReasonFor(entry("src/index.ts"))).toBeNull();
    expect(skipReasonFor(entry("README.md"))).toBeNull();
  });

  it("drops dependency and build directories", () => {
    expect(skipReasonFor(entry("node_modules/react/index.js"))).toBe("excluded_directory");
    expect(skipReasonFor(entry("dist/bundle.js"))).toBe("excluded_directory");
    expect(skipReasonFor(entry("a/b/.next/x.js"))).toBe("excluded_directory");
  });

  it("does not drop a file whose NAME matches a directory rule", () => {
    // "dist.ts" is source; only a path *segment* called dist is excluded.
    expect(skipReasonFor(entry("src/dist.ts"))).toBeNull();
  });

  it("drops lockfiles, minified bundles and binaries", () => {
    expect(skipReasonFor(entry("package-lock.json"))).toBe("lockfile");
    expect(skipReasonFor(entry("yarn.lock"))).toBe("lockfile");
    expect(skipReasonFor(entry("app.min.js"))).toBe("minified");
    expect(skipReasonFor(entry("logo.png"))).toBe("binary_or_asset");
    expect(skipReasonFor(entry("font.woff2"))).toBe("binary_or_asset");
  });

  it("drops files that are too large or empty", () => {
    expect(skipReasonFor(entry("huge.ts", 200_000))).toBe("too_large");
    expect(skipReasonFor(entry("empty.ts", 0))).toBe("empty");
  });
});

describe("selectFiles", () => {
  it("returns every entry, included or not", () => {
    const entries = [
      { path: "README.md", size: 500 },
      { path: "node_modules/x/index.js", size: 500 },
      { path: "src/main.ts", size: 500 },
    ];
    const result = selectFiles(entries);
    expect(result).toHaveLength(3);
    expect(result.filter((f) => f.included)).toHaveLength(2);
  });

  it("gives every excluded file a reason", () => {
    const result = selectFiles([
      { path: "package-lock.json", size: 90_000 },
      { path: "src/a.ts", size: 100 },
    ]);
    for (const file of result) {
      if (!file.included) expect(file.skipReason).toBeTruthy();
      else expect(file.skipReason).toBeNull();
    }
  });

  it("ranks manifests and entry points above deep source", () => {
    const result = selectFiles([
      { path: "src/deep/nested/thing/helper.ts", size: 100 },
      { path: "README.md", size: 100 },
      { path: "package.json", size: 100 },
    ]);
    const included = result.filter((f) => f.included).map((f) => f.path);
    expect(included.slice(0, 2).sort()).toEqual(["README.md", "package.json"]);
  });

  it("enforces the file cap and says which cap bound", () => {
    const entries = Array.from({ length: MAX_FILES + 15 }, (_, i) => ({
      path: `src/file-${String(i).padStart(3, "0")}.ts`,
      size: 100,
    }));
    const result = selectFiles(entries);

    expect(result.filter((f) => f.included)).toHaveLength(MAX_FILES);
    expect(
      result.filter((f) => f.skipReason === "file_cap"),
    ).toHaveLength(15);
  });

  it("enforces the byte cap", () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({
      path: `src/file-${i}.ts`,
      size: 50_000,
    }));
    const result = selectFiles(entries);
    const included = result.filter((f) => f.included);

    const total = included.reduce((sum, f) => sum + f.byteSize, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
    expect(result.some((f) => f.skipReason === "byte_cap")).toBe(true);
  });

  it("is deterministic for the same tree", () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({
      path: `src/f${i}.ts`,
      size: 1000,
    }));
    expect(selectFiles(entries)).toEqual(selectFiles(entries));
  });

  it("handles an empty tree", () => {
    expect(selectFiles([])).toEqual([]);
  });
});
