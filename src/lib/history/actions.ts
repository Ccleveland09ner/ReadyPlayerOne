"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { clearMyHistory } from "@/lib/history/clear";
import { CLEAR_CONFIRMATION } from "@/lib/history/confirm";

/**
 * Clear Quiz History.
 *
 * Irreversible, so the form requires a typed confirmation the action checks
 * again here -- a server action is a public endpoint, and the two-step button
 * in the UI is a courtesy to the player, not a guard.
 *
 * The identity is read from the session and the anon cookie, never from the
 * form. Accepting an id here would turn "clear my history" into "clear
 * anyone's history" for whoever guessed a uuid.
 */

export type ClearHistoryState = {
  error?: string;
  cleared?: { deleted: number; preserved: number };
};

export async function clearHistoryAction(
  _previous: ClearHistoryState,
  formData: FormData,
): Promise<ClearHistoryState> {
  if (!isSupabaseConfigured()) {
    return { error: "History needs Supabase credentials, which are not set." };
  }

  const typed = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (typed !== CLEAR_CONFIRMATION) {
    return { error: `Type ${CLEAR_CONFIRMATION} to confirm.` };
  }

  try {
    const cleared = await clearMyHistory();

    // History, Report, the top-bar selector and the XP meter all read from the
    // rows that just went away, and the meter is in the shell on every screen.
    revalidatePath("/", "layout");
    return { cleared };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not clear your history. Try again.",
    };
  }
}
