"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startRun } from "@/lib/api-client";

/**
 * Try Again on the results screen.
 *
 * This used to be a `<Link href={`/runs/${runId}/start`}>` back to the run you
 * had just finished -- and `/runs/:id` redirects a run with a `completed_at`
 * straight to `/complete`, so the button was a closed loop: results, confirm,
 * results. There was no way to retake a repository from the results screen at
 * all.
 *
 * A retake is a new run, which is what the schema was always built for: the
 * new row points `snapshot_run_id` at the finished one, reuses its chunks and
 * manifest, and regenerates only the questions. So it costs one model call
 * rather than a full re-ingestion, and you get five different questions on the
 * same commit instead of the five you have already seen the answers to.
 *
 * It lands on `/runs/:newId` rather than the confirm screen. You confirmed
 * this repository a minute ago; "again" should mean again.
 */
export function TryAgainButton({ owner, repo }: { owner: string; repo: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retake() {
    if (starting) return;
    setStarting(true);
    setError(null);

    try {
      const { runId } = await startRun(`${owner}/${repo}`);
      router.push(`/runs/${runId}`);
      router.refresh();
    } catch (caught) {
      // Stays on the results screen with a reason. Navigating away on a
      // failure would lose the score the player is looking at.
      setError(
        caught instanceof Error ? caught.message : "Could not start another run.",
      );
      setStarting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={retake}
        disabled={starting}
        className="btn-pixel btn-8bit btn-ghost disabled:cursor-not-allowed disabled:opacity-60"
      >
        {starting ? "DEALING NEW QUESTIONS…" : "TRY AGAIN"}
      </button>
      {error ? (
        <p
          role="alert"
          className="text-pixel basis-full text-center text-[10px] leading-relaxed text-[#ff5470]"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
