"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { claimAnonymousRuns } from "@/lib/identity";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/log";
import {
  describeSignInError,
  describeSignUpError,
  validateSignIn,
  validateSignUp,
} from "@/lib/auth/validate";

/**
 * Server actions behind the log in and create profile forms.
 *
 * They live here rather than in the components for the reason the rest of the
 * codebase does it: the browser never holds a Supabase admin surface, and the
 * claim-on-sign-in write needs the service role. The forms stay presentational
 * and call these.
 *
 * Both actions return a message on failure and redirect on success, which is
 * the shape `useActionState` wants.
 */

export type AuthState = {
  error?: string;
  /** Set when the account was created but needs an email confirmation. */
  notice?: string;
};

function unconfigured(): AuthState {
  return {
    error:
      "Accounts are not available: this deployment has no Supabase credentials configured.",
  };
}

/**
 * Adopts the runs this browser made anonymously.
 *
 * Never allowed to fail the sign-in: a player who cannot see three old runs is
 * a worse outcome than one who cannot get in at all, but only slightly -- and
 * losing the session over a bookkeeping update would be absurd.
 */
async function claimQuietly(userId: string): Promise<void> {
  try {
    const claimed = await claimAnonymousRuns(userId);
    if (claimed > 0) log.info("run.cached", { claimedRuns: claimed, userId });
  } catch (error) {
    log.warn("run.fail", {
      kind: "claim_failed",
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function signInAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) return unconfigured();

  const parsed = validateSignIn({
    email: formData.get("email") as string | null,
    password: formData.get("password") as string | null,
  });
  if (!parsed.ok) return { error: parsed.error };
  const { email, password } = parsed.value;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Deliberately generic: distinguishing "no such account" from "wrong
  // password" tells an attacker which emails are registered.
  if (error) return { error: describeSignInError(error.message) };

  if (data.user) await claimQuietly(data.user.id);

  redirect("/home");
}

export async function signUpAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) return unconfigured();

  const parsed = validateSignUp({
    fullName: formData.get("fullName") as string | null,
    email: formData.get("email") as string | null,
    password: formData.get("password") as string | null,
    confirmPassword: formData.get("confirmPassword") as string | null,
  });
  if (!parsed.ok) return { error: parsed.error };
  const { fullName, email, password } = parsed.value;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: fullName } },
  });

  if (error) return { error: describeSignUpError(error.message) };

  // Whether signUp returns a session depends on the project's email
  // confirmation setting. With confirmations on -- the Supabase default, and
  // what this project currently has -- there is no session yet and the player
  // has to click a link first. Saying so is better than redirecting them to a
  // Home screen that will bounce them straight back here.
  if (!data.session) {
    return {
      notice:
        "Account created. Check your email for the confirmation link, then log in.",
    };
  }

  if (data.user) {
    await createProfile(data.user.id, fullName);
    await claimQuietly(data.user.id);
  }

  redirect("/home");
}

/**
 * Seeds the profile row.
 *
 * Best effort: a missing profile costs a display name, not access, and the
 * account is already created by the time we get here -- failing the sign-up
 * over it would be the wrong trade.
 */
async function createProfile(userId: string, fullName: string): Promise<void> {
  try {
    const service = createServiceClient();
    await service.from("profiles").upsert(
      {
        id: userId,
        display_name: fullName,
        username: `player_${userId.slice(0, 8)}`,
      },
      { onConflict: "id" },
    );
  } catch (error) {
    log.warn("run.fail", {
      kind: "profile_create_failed",
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
