import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  ANON_COOKIE,
  SEEN_COOKIE,
  anonCookieOptions,
  isUuid,
  seenCookieOptions,
} from "@/lib/identity/cookie";

/** The landing page. `/` is the screen itself, not a redirect to one. */
const LANDING = "/";

/** Reachable before the landing screen has been seen. */
const OPEN_PREFIXES = ["/login", "/signup", "/api", "/logout"];

/**
 * Runs on every request.
 *
 * Three jobs: refresh the Supabase auth session (skipped when Supabase is not
 * configured, so the UI still renders), make sure this browser has an
 * anonymous identity before it can create a run, and hold the intended order
 * of screens -- landing at `/`, then log in or create a profile, then the app
 * at `/home`.
 *
 * Issuing the anon cookie here rather than in the run route is the cheapest
 * hook available -- this already runs on every request -- and it guarantees
 * the id exists before the first POST /api/runs.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const seen = request.cookies.get(SEEN_COOKIE)?.value === "1";
  const isLanding = pathname === LANDING;
  const isOpen =
    isLanding ||
    OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // A signed-in visitor goes straight through: someone returning to a
  // bookmarked /history in a new browser has no seen-cookie but has every
  // right to be there, and bouncing them to a landing screen would be a bug
  // rather than an introduction.
  //
  // Presence of the Supabase auth cookie is the check, not a verified session.
  // That is deliberate and safe: this gate decides which screen to show, not
  // whether to grant access. Every real authorisation boundary is elsewhere --
  // RLS on the tables, the service-role split, and the server-side identity
  // read that scopes history and reports. Forging this cookie skips an
  // animation and nothing else. Verifying it here would mean a network round
  // trip to Supabase on every request the matcher touches.
  if (!seen && !isOpen && !hasSupabaseSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = LANDING;
    url.search = "";
    return withAnonCookie(request, NextResponse.redirect(url));
  }

  const response = await updateSession(request);

  // Seeing the landing screen is what marks it seen, so the redirect above
  // fires at most once per browser and needs no click handler to set it.
  if (!seen && isLanding) {
    response.cookies.set(SEEN_COOKIE, "1", seenCookieOptions());
  }

  return withAnonCookie(request, response);
}

/**
 * Does this request carry a Supabase session cookie?
 *
 * `@supabase/ssr` stores the session under `sb-<project-ref>-auth-token`, and
 * splits it across `.0`, `.1` … when it outgrows one cookie, so this matches on
 * the prefix rather than an exact name.
 */
function hasSupabaseSession(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name));
}

function withAnonCookie<T extends NextResponse>(request: NextRequest, response: T): T {
  const existing = request.cookies.get(ANON_COOKIE)?.value;
  if (!existing || !isUuid(existing)) {
    response.cookies.set(ANON_COOKIE, crypto.randomUUID(), anonCookieOptions());
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
