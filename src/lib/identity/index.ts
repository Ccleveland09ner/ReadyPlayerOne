import "server-only";
import { cookies } from "next/headers";
import { ANON_COOKIE, anonCookieOptions, isUuid } from "@/lib/identity/cookie";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Anonymous identity.
 *
 * Every run is stamped with the browser's `anon_id`, plus `user_id` when a
 * session exists. History works with no account; signing in claims every run
 * carrying that `anon_id`.
 *
 * The cookie itself is minted in `src/proxy.ts`, which already runs on every
 * request for Supabase session refresh -- the cheapest hook, and it guarantees
 * the id exists before the first run is created.
 *
 * Known limitation, stated rather than solved: clearing cookies or switching
 * browsers loses anonymous history. Signing in is the fix, and the History
 * empty state says so. Device-independent anonymous identity is not a
 * 24-hour problem.
 */

export {
  ANON_COOKIE,
  ANON_COOKIE_MAX_AGE,
  anonCookieOptions,
  isUuid,
} from "@/lib/identity/cookie";

/**
 * Reads the anon id from the request cookie.
 *
 * Deliberately never accepts one as an argument: if a client could supply an
 * `anon_id`, it could read any other player's history by guessing one.
 */
export async function readAnonId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(ANON_COOKIE)?.value;
  return value && isUuid(value) ? value : null;
}

/** Reads the anon id, minting one if the proxy has not run yet. */
export async function requireAnonId(): Promise<string> {
  const existing = await readAnonId();
  if (existing) return existing;

  const fresh = crypto.randomUUID();
  try {
    const store = await cookies();
    store.set(ANON_COOKIE, fresh, anonCookieOptions());
  } catch {
    // Called from a Server Component, which cannot write cookies. The proxy
    // sets it on the next request; this run still gets a stable id now.
  }
  return fresh;
}

/**
 * Claim-on-sign-in.
 *
 * Cheap, idempotent, and it means signing in never appears to erase history.
 * Call it after a successful authentication.
 */
export async function claimAnonymousRuns(userId: string): Promise<number> {
  const anonId = await readAnonId();
  if (!anonId) return 0;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("runs")
    .update({ user_id: userId })
    .eq("anon_id", anonId)
    .is("user_id", null)
    .select("id");

  if (error) throw new Error(`Could not claim runs: ${error.message}`);
  return (data ?? []).length;
}
