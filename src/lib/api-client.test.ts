import { describe, expect, it } from "vitest";
import { errorCode, errorMessage } from "@/lib/api-client";

/**
 * The regression these exist for: client components read `payload.error` and
 * passed it to `setError`, so the envelope's *object* landed in React state.
 * Rendering an object as a child throws, so a mistyped repository URL on /home
 * took the screen down rather than reporting the problem.
 */
describe("errorMessage", () => {
  const envelope = {
    error: {
      code: "repo_unavailable",
      message: "Could not find owner/repo. It may be private.",
      retryable: false,
    },
  };

  it("reads the message out of the real envelope", () => {
    expect(errorMessage(envelope, "fallback")).toBe(
      "Could not find owner/repo. It may be private.",
    );
  });

  it("always returns a string, never the object", () => {
    expect(typeof errorMessage(envelope, "fallback")).toBe("string");
  });

  it("falls back when the envelope carries no message", () => {
    expect(errorMessage({ error: { code: "internal" } }, "fallback")).toBe(
      "fallback",
    );
    expect(errorMessage({ error: {} }, "fallback")).toBe("fallback");
    expect(errorMessage({}, "fallback")).toBe("fallback");
  });

  it("falls back on an empty message rather than showing a blank error", () => {
    expect(errorMessage({ error: { message: "" } }, "fallback")).toBe("fallback");
  });

  it("survives a body that is not the envelope at all", () => {
    for (const body of [null, undefined, "", "boom", 42, [], { ok: true }]) {
      expect(errorMessage(body, "fallback")).toBe("fallback");
    }
  });

  it("accepts a bare string error from a proxy or a future route", () => {
    expect(errorMessage({ error: "Bad gateway" }, "fallback")).toBe("Bad gateway");
  });
});

describe("errorCode", () => {
  it("exposes the stable code for branching", () => {
    expect(errorCode({ error: { code: "rate_limited" } })).toBe("rate_limited");
  });

  it("is null for anything without one", () => {
    expect(errorCode({ error: "Bad gateway" })).toBeNull();
    expect(errorCode({ runId: "abc" })).toBeNull();
    expect(errorCode(null)).toBeNull();
  });
});
