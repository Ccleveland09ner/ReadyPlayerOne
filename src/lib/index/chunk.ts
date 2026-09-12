/**
 * Line-aware chunking.
 *
 * The entire citation claim rests on the arithmetic in this file: if a chunk
 * says lines 61-120 and the source disagrees, every citation built from it is
 * a lie told confidently. `start_line` and `end_line` are 1-based and
 * inclusive, and they must match the source file exactly.
 *
 * Pure -- no network, no environment, no database. Tested directly.
 */

/** Files shorter than this become a single chunk. */
export const WHOLE_FILE_UNDER_LINES = 40;
/** Otherwise, windows of this many lines... */
export const CHUNK_WINDOW_LINES = 60;
/** ...overlapping by this many, so a split function still appears whole. */
export const CHUNK_OVERLAP_LINES = 10;

export type SourceChunk = {
  filePath: string;
  /** 1-based, inclusive. */
  startLine: number;
  /** 1-based, inclusive. */
  endLine: number;
  content: string;
};

/**
 * Splits text into lines the way a code host counts them.
 *
 * Normalizes CRLF and lone CR to LF first, so a Windows checkout and a Unix
 * one produce identical line numbers. A trailing newline terminates the last
 * line rather than starting an empty one -- a 3-line file ending in "\n" has
 * 3 lines, not 4, which is what GitHub's blob view shows and therefore what a
 * citation must agree with.
 */
export function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Line count as a citation would report it. */
export function countLines(text: string): number {
  return splitLines(text).length;
}

/**
 * Chunks one file.
 *
 * Windows advance by (window - overlap). The final window is clamped to the
 * last line rather than padded, and a window that would duplicate a range
 * already emitted is dropped -- without that clamp, a file of 65 lines emits
 * 1-60 and then 51-65, which is correct, but a file of 61 emits 1-60 and
 * 51-61, where the second window is almost entirely overlap.
 */
export function chunkFile(filePath: string, text: string): SourceChunk[] {
  const lines = splitLines(text);

  // An empty file has one empty line by the split above; nothing to cite.
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
    return [];
  }

  if (lines.length <= WHOLE_FILE_UNDER_LINES) {
    return [
      {
        filePath,
        startLine: 1,
        endLine: lines.length,
        content: lines.join("\n"),
      },
    ];
  }

  const stride = CHUNK_WINDOW_LINES - CHUNK_OVERLAP_LINES;
  const chunks: SourceChunk[] = [];

  for (let start = 0; start < lines.length; start += stride) {
    const end = Math.min(start + CHUNK_WINDOW_LINES, lines.length);

    chunks.push({
      filePath,
      startLine: start + 1,
      endLine: end,
      content: lines.slice(start, end).join("\n"),
    });

    // The window reached the end of the file; another stride would only
    // re-emit lines already covered.
    if (end === lines.length) break;
  }

  return chunks;
}
