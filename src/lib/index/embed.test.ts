import { describe, expect, it } from "vitest";
import {
  MAX_EMBED_INPUT_CHARS,
  isInputTooLong,
  truncateForEmbedding,
} from "@/lib/index/embed";
import { chunkFile } from "@/lib/index/chunk";

/**
 * Embedding input bounds.
 *
 * The chunker bounds chunks by line count, which says nothing about line
 * length. A provider rejects an oversized input with a 400 that takes down the
 * whole batch -- and therefore the whole run -- so the ceiling has to be
 * enforced on our side.
 */

describe("truncateForEmbedding", () => {
  it("leaves ordinary chunks alone", () => {
    const text = "const x = 1;\n".repeat(50);
    expect(truncateForEmbedding(text)).toBe(text);
  });

  it("caps an oversized input", () => {
    const huge = "x".repeat(MAX_EMBED_INPUT_CHARS * 3);
    expect(truncateForEmbedding(huge)).toHaveLength(MAX_EMBED_INPUT_CHARS);
  });

  it("keeps the beginning, which is the part that carries the signal", () => {
    const text = "FIRST" + "y".repeat(MAX_EMBED_INPUT_CHARS * 2);
    expect(truncateForEmbedding(text).startsWith("FIRST")).toBe(true);
  });

  it("is a no-op exactly at the limit", () => {
    const exact = "z".repeat(MAX_EMBED_INPUT_CHARS);
    expect(truncateForEmbedding(exact)).toBe(exact);
  });

  it("bounds a chunk built from pathologically long lines", () => {
    // The shape that broke sindresorhus/awesome: few lines, each enormous.
    // The chunker is happy -- 60 lines is 60 lines -- and the embedding
    // provider is not.
    const longLine = "- [Some Entry](https://example.com) - A description. ".repeat(
      200,
    );
    const text = Array.from({ length: 60 }, () => longLine).join("\n");
    const [chunk] = chunkFile("README.md", text);

    expect(chunk.content.length).toBeGreaterThan(MAX_EMBED_INPUT_CHARS);
    expect(truncateForEmbedding(chunk.content)).toHaveLength(
      MAX_EMBED_INPUT_CHARS,
    );
  });

  it("does not change the chunk that gets stored", () => {
    // Only the embedding input is truncated. The stored content and its line
    // range stay exact, because citations are checked against them.
    const longLine = "x".repeat(MAX_EMBED_INPUT_CHARS);
    const text = Array.from({ length: 50 }, (_, i) => `${i}:${longLine}`).join("\n");
    const [chunk] = chunkFile("big.md", text);

    expect(chunk.startLine).toBe(1);
    expect(chunk.endLine).toBe(50);
    expect(chunk.content.length).toBeGreaterThan(MAX_EMBED_INPUT_CHARS);
  });
});

describe("isInputTooLong", () => {
  it("recognises the providers' too-long messages", () => {
    expect(isInputTooLong("Invalid 'input[9]': maximum input length is 8192 tokens.")).toBe(true);
    expect(isInputTooLong("This model's maximum context length is 8192 tokens")).toBe(true);
    expect(isInputTooLong("Please reduce the length of your input")).toBe(true);
  });

  it("does not mistake other 400s for it", () => {
    // Shrinking cannot fix these, so treating them as recoverable would loop.
    expect(isInputTooLong("Incorrect API key provided")).toBe(false);
    expect(isInputTooLong("model_not_found")).toBe(false);
    expect(isInputTooLong("")).toBe(false);
  });
});
