import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses Row Level Security, so it exists only inside
 * route handlers and server-side queries -- never in a client component, and
 * never behind a NEXT_PUBLIC_ variable.
 *
 * Every write in this product goes through this client. The anon role holds
 * no insert, update or delete policy on any table.
 */
export function createServiceClient() {
  return createSupabaseClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
