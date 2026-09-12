/**
 * Form validation for the auth and profile actions.
 *
 * Pure, so it can be tested without Supabase, `next/headers` or a running
 * server. The actions own the side effects; this owns the rules.
 */

export type Invalid = { ok: false; error: string };
export type Valid<T> = { ok: true; value: T };
export type Validated<T> = Valid<T> | Invalid;

export const MIN_PASSWORD_LENGTH = 8;
export const USERNAME_RE = /^[a-z0-9_]{3,24}$/i;

export type SignUpInput = {
  fullName: string;
  email: string;
  password: string;
};

export function validateSignUp(fields: {
  fullName?: string | null;
  email?: string | null;
  password?: string | null;
  confirmPassword?: string | null;
}): Validated<SignUpInput> {
  const fullName = (fields.fullName ?? "").trim();
  const email = (fields.email ?? "").trim();
  const password = fields.password ?? "";
  const confirmPassword = fields.confirmPassword ?? "";

  if (!fullName || !email || !password) {
    return { ok: false, error: "Fill in your name, email and a password." };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "Those passwords do not match." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
    };
  }

  return { ok: true, value: { fullName, email, password } };
}

export function validateSignIn(fields: {
  email?: string | null;
  password?: string | null;
}): Validated<{ email: string; password: string }> {
  const email = (fields.email ?? "").trim();
  const password = fields.password ?? "";

  if (!email || !password) {
    return { ok: false, error: "Enter both an email and a password." };
  }
  return { ok: true, value: { email, password } };
}

export function validateProfile(fields: {
  username?: string | null;
  displayName?: string | null;
}): Validated<{ username: string | null; displayName: string }> {
  const username = (fields.username ?? "").trim();
  const displayName = (fields.displayName ?? "").trim();

  if (!displayName) return { ok: false, error: "Enter a display name." };
  if (username && !USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: "Usernames are 3-24 characters: letters, numbers and underscores.",
    };
  }

  return { ok: true, value: { username: username || null, displayName } };
}

/**
 * Turns a Supabase auth error into something worth showing a player.
 *
 * Sign-in failures are deliberately collapsed into one message: telling the
 * difference between "no such account" and "wrong password" tells an attacker
 * which email addresses are registered.
 */
export function describeSignInError(message: string): string {
  return message.toLowerCase().includes("confirm")
    ? "Confirm your email address first -- check your inbox for the link."
    : "That email and password did not match. Check both and try again.";
}

export function describeSignUpError(message: string): string {
  return message.toLowerCase().includes("already registered")
    ? "An account with that email already exists. Log in instead."
    : message;
}
