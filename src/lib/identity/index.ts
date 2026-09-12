/**
 * Anonymous identity.
 *
 * Not implemented yet. On any request without an rpo_aid cookie, issue one:
 * a v4 uuid, httpOnly, sameSite=lax, secure, one-year expiry. src/proxy.ts
 * already runs on every request for Supabase session refresh, so issuing the
 * cookie there guarantees the id exists before the first run.
 *
 * Claim on sign-in:
 *   update runs set user_id = $uid where anon_id = $aid and user_id is null
 *
 * Known limitation, stated rather than solved: clearing cookies or switching
 * browsers loses anonymous history. Signing in is the fix, and the History
 * empty state says so.
 */

export const ANON_COOKIE = "rpo_aid";
export const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
