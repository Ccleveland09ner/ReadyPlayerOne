import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  ANON_COOKIE,
  SEEN_COOKIE,
  anonCookieOptions,
  isUuid,
  seenCookieOptions,
} from "@/lib/identity/cookie";

/** Routes that are reachable before the splash has been shown. */
const OPEN_PREFIXES = ["/splash", "/login", "/signup", "/api", "/logout"];

/**
 * Runs on every request.
 *
 * Three jobs: refresh the Supabase auth session (skipped when Supabase is not
 * configured, so the UI still renders), make sure this browser has an anonymous
 * identity before it can create a run, and send first-time visitors to the
 * splash so the intended splash -> log in -> Home order holds.
 *
 * Issuing the anon cookie here rather than in the run route is the cheapest
 * hook available -- this already runs on every request -- and it guarantees
 * the id exists before the first POST /api/runs.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const seen = request.cookies.get(SEEN_COOKIE)?.value === "1";
  const isOpen = OPEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // The gate is deliberately on a cookie rather than on a session. Log in and
  // sign up are still presentational -- they push to `/` without creating a
  // session -- so gating on "has a Supabase user" would bounce the visitor
  // straight back here and loop forever.
  //
  // TODO (accounts, P1): once the auth forms really sign in, let a signed-in
  // visitor through on their session and keep this cookie as the anonymous
  // demo path's equivalent.
  if (!seen && !isOpen) {
    const url = request.nextUrl.clone();
    url.pathname = "/splash";
    url.search = "";
    return withAnonCookie(request, NextResponse.redirect(url));
  }

  const response = await updateSession(request);

  // Seeing the splash is what marks it seen, so the redirect above fires at
  // most once per browser and needs no click handler to set the cookie.
  if (!seen && pathname === "/splash") {
    response.cookies.set(SEEN_COOKIE, "1", seenCookieOptions());
  }

  return withAnonCookie(request, response);
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
