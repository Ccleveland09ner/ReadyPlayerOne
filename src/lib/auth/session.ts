import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Reading the current session.
 *
 * One place, so every screen agrees on what "signed in" means and none of them
 * has to remember that an unconfigured deployment must not throw.
 */

/** The signed-in user, or null. Never throws -- unconfigured means signed out. */
export async function currentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

export type PlayerProfile = {
  userId: string | null;
  /** What the HUD shows. Falls back through profile, metadata, then email. */
  displayName: string;
  email: string | null;
};

const ANONYMOUS: PlayerProfile = {
  userId: null,
  displayName: "Player_Intern",
  email: null,
};

/**
 * The player card in the top bar.
 *
 * Anonymous play is the demo path, so a missing session is normal rather than
 * an error state -- it just means the default name. The profiles row is read
 * with the service client because RLS scopes `profiles` to the owner and this
 * runs server-side anyway.
 */
export async function currentProfile(): Promise<PlayerProfile> {
  const user = await currentUser();
  if (!user) return ANONYMOUS;

  const metadataName =
    (user.user_metadata?.display_name as string | undefined) ?? null;

  let profileName: string | null = null;
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle();
    profileName = data?.display_name ?? data?.username ?? null;
  } catch {
    // A missing profile row costs a display name, not a session.
  }

  return {
    userId: user.id,
    displayName:
      profileName ?? metadataName ?? user.email?.split("@")[0] ?? "Player",
    email: user.email ?? null,
  };
}

export type SettingsProfile = PlayerProfile & { username: string | null };

/** The Settings panel needs the username too, which the HUD does not. */
export async function currentSettingsProfile(): Promise<SettingsProfile> {
  const user = await currentUser();
  if (!user) return { ...ANONYMOUS, username: null };

  let username: string | null = null;
  let displayName: string | null = null;
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle();
    username = data?.username ?? null;
    displayName = data?.display_name ?? null;
  } catch {
    // No profile row yet -- the form saves one on first submit.
  }

  return {
    userId: user.id,
    username,
    displayName:
      displayName ??
      (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Player",
    email: user.email ?? null,
  };
}
