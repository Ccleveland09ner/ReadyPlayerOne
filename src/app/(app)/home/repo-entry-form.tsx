"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { BranchIcon, Play } from "@/components/ui/Icons";
import { startRun } from "@/lib/api-client";

/**
 * Posts to /api/runs, which resolves the commit SHA and returns a run id.
 * A cached repository comes back with cached: true and skips indexing.
 */
export function RepoEntryForm() {
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const { runId } = await startRun(repo);
      router.push(`/runs/${runId}/start`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not read that repository.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 flex w-full max-w-xl flex-col items-center gap-6"
    >
      <label
        className="box-8bit flex w-full items-center gap-3 px-4 py-3"
        style={
          {
            "--box-bg": "#e4e6f3",
            "--box-edge": "#c2c6e2",
            "--box-hi": "#ffffff",
            "--box-lo": "rgba(0,0,0,0.12)",
          } as CSSProperties
        }
      >
        <span className="sr-only">Repository URL</span>
        <BranchIcon className="text-xl text-[#7b76ad]" />
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="e.g. https://github.com/username/repo"
          className="text-pixel text-ink w-full bg-transparent text-[11px] tracking-wide outline-none placeholder:text-[#8b88b5] sm:text-xs"
        />
      </label>
      {error ? (
        <p className="text-pixel max-w-xl text-center text-[10px] tracking-wide text-[#c0392b]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting || repo.trim().length === 0}
        className="btn-pixel btn-8bit btn-gold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "READING REPO\u2026" : "LET\u2019S PLAY"} <Play className="text-xs" />
      </button>
    </form>
  );
}
