"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { validateProfile } from "@/lib/auth/validate";

/**
 * Saving the profile.
 *
 * Only the Profile panel is backed: `profiles` has `username` and
 * `display_name`, and the display name is what the HUD renders. The
 * Appearance, Data & Privacy and Account panels are P2 in the PRD with no
 * schema behind them, so they stay presentational rather than getting an
 * architecture invented for them.
 */

export type ProfileState = { error?: string; saved?: boolean };

export async function updateProfileAction(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  if (!isSupabaseConfigured()) {
    return { error: "Profiles need Supabase credentials, which are not set." };
  }

  // The user id comes from the session, never from the form. Trusting a
  // client-supplied id here would let anyone rewrite anyone's profile.
  const user = await currentUser();
  if (!user) return { error: "Log in to save a profile." };

  const parsed = validateProfile({
    username: formData.get("username") as string | null,
    displayName: formData.get("displayName") as string | null,
  });
  if (!parsed.ok) return { error: parsed.error };
  const { username, displayName } = parsed.value;

  const service = createServiceClient();
  const { error } = await service.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
      ...(username ? { username } : {}),
    },
    { onConflict: "id" },
  );

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That username is taken."
          : "Could not save your profile. Try again.",
    };
  }

  // The HUD reads the display name on every shell render, so the whole app
  // needs revalidating, not just this page.
  revalidatePath("/", "layout");
  return { saved: true };
}
