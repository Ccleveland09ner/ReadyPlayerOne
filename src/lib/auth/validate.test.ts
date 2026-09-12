import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  describeSignInError,
  describeSignUpError,
  validateProfile,
  validateSignIn,
  validateSignUp,
} from "@/lib/auth/validate";

/**
 * Auth form validation.
 *
 * These run before anything reaches Supabase, so a mistake here is either a
 * player locked out of a valid account or a bad value written to a profile.
 */

describe("validateSignUp", () => {
  const good = {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    password: "analytical-engine",
    confirmPassword: "analytical-engine",
  };

  it("accepts a complete form", () => {
    const result = validateSignUp(good);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe("ada@example.com");
  });

  it("trims the name and email but never the password", () => {
    const result = validateSignUp({
      ...good,
      fullName: "  Ada Lovelace  ",
      email: "  ada@example.com  ",
      password: " keep spaces ",
      confirmPassword: " keep spaces ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fullName).toBe("Ada Lovelace");
      expect(result.value.email).toBe("ada@example.com");
      // Trimming a password silently changes the credential the account is
      // created with, and the visitor can never type it back.
      expect(result.value.password).toBe(" keep spaces ");
    }
  });

  it("rejects missing fields", () => {
    for (const missing of ["fullName", "email", "password"] as const) {
      const result = validateSignUp({ ...good, [missing]: "" });
      expect(result.ok).toBe(false);
    }
  });

  it("rejects a whitespace-only name", () => {
    expect(validateSignUp({ ...good, fullName: "   " }).ok).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = validateSignUp({ ...good, confirmPassword: "something-else" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/do not match/i);
  });

  it("enforces the minimum password length", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    const result = validateSignUp({
      ...good,
      password: short,
      confirmPassword: short,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least/i);
  });

  it("accepts exactly the minimum length", () => {
    const exact = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(
      validateSignUp({ ...good, password: exact, confirmPassword: exact }).ok,
    ).toBe(true);
  });

  it("reports the mismatch before the length", () => {
    // Both are wrong; "they do not match" is the one the visitor can act on
    // without retyping everything.
    const result = validateSignUp({ ...good, password: "abc", confirmPassword: "xyz" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/do not match/i);
  });
});

describe("validateSignIn", () => {
  it("accepts an email and password", () => {
    expect(validateSignIn({ email: "a@b.com", password: "hunter22" }).ok).toBe(true);
  });

  it("rejects either one missing", () => {
    expect(validateSignIn({ email: "", password: "hunter22" }).ok).toBe(false);
    expect(validateSignIn({ email: "a@b.com", password: "" }).ok).toBe(false);
  });

  it("does not enforce a length on sign-in", () => {
    // The rule may have changed since the account was made; rejecting a short
    // password here would lock out an existing user rather than protect them.
    expect(validateSignIn({ email: "a@b.com", password: "old" }).ok).toBe(true);
  });
});

describe("validateProfile", () => {
  it("accepts a display name with no username", () => {
    const result = validateProfile({ displayName: "Ada", username: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.username).toBeNull();
  });

  it("requires a display name", () => {
    expect(validateProfile({ displayName: "  ", username: "ada" }).ok).toBe(false);
  });

  it("accepts valid usernames", () => {
    for (const username of ["ada", "ada_l", "Ada_99", "a".repeat(24)]) {
      expect(validateProfile({ displayName: "Ada", username }).ok).toBe(true);
    }
  });

  it("rejects usernames that are too short, too long or contain punctuation", () => {
    for (const username of ["ad", "a".repeat(25), "ada lovelace", "ada-l", "ada!"]) {
      expect(validateProfile({ displayName: "Ada", username }).ok).toBe(false);
    }
  });
});

describe("error messages", () => {
  it("collapses sign-in failures into one message", () => {
    // Distinguishing "no such account" from "wrong password" tells an attacker
    // which addresses are registered.
    const wrongPassword = describeSignInError("Invalid login credentials");
    const noSuchUser = describeSignInError("User not found");
    expect(wrongPassword).toBe(noSuchUser);
  });

  it("calls out an unconfirmed email, which the visitor can act on", () => {
    expect(describeSignInError("Email not confirmed")).toMatch(/confirm/i);
  });

  it("points an existing account at the login page", () => {
    expect(describeSignUpError("User already registered")).toMatch(/log in/i);
  });

  it("passes through sign-up errors it does not recognise", () => {
    expect(describeSignUpError("Password is too weak")).toBe("Password is too weak");
  });
});
