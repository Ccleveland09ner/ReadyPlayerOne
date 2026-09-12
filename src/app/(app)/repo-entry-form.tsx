"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BranchIcon, Play } from "@/components/ui/Icons";

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
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repo }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not read that repository.");
        setSubmitting(false);
        return;
      }

      router.push(`/runs/${payload.runId}/start`);
    } catch {
      setError("Could not reach the server. Check your connection.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 flex w-full max-w-xl flex-col items-center gap-6"
    >
      <label className="flex w-full items-center gap-3 rounded-lg bg-[#e4e6f3] px-4 py-3" style={{ border: "2px solid #c2c6e2" }}>
        <span className="sr-only">Repository URL</span>
        <BranchIcon className="text-xl text-[#7b76ad]" />
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="e.g. https://github.com/username/repo"
          className="text-display text-ink w-full bg-transparent text-lg font-medium outline-none placeholder:text-[#8b88b5]"
        />
      </label>
      {error ? (
        <p className="text-display max-w-xl text-center text-base font-medium text-[#c0392b]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting || repo.trim().length === 0}
        className="btn-pixel btn-gold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "READING REPO\u2026" : "LET\u2019S PLAY"} <Play className="text-xs" />
      </button>
    </form>
  );
}
