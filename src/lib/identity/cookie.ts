/**
 * Anon-cookie constants, free of `server-only` and `next/headers`.
 *
 * Split out because `src/proxy.ts` runs in the edge runtime and cannot import
 * either of those -- but it is the place that mints the cookie, so it needs
 * the name and options.
 */

export const ANON_COOKIE = "rpo_aid";
export const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function anonCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANON_COOKIE_MAX_AGE,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
