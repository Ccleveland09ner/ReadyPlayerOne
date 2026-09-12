import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { ANON_COOKIE, anonCookieOptions, isUuid } from "@/lib/identity/cookie";

/**
 * Runs on every request.
 *
 * Two jobs: refresh the Supabase auth session (skipped when Supabase is not
 * configured, so the UI still renders), and make sure this browser has an
 * anonymous identity before it can create a run.
 *
 * Issuing the anon cookie here rather than in the run route is the cheapest
 * hook available -- this already runs on every request -- and it guarantees
 * the id exists before the first POST /api/runs.
 */
export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

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
