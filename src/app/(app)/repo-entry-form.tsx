"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BranchIcon, Play } from "@/components/ui/Icons";
import { DEMO_RUN_ID } from "@/lib/mock-data";

/**
 * TODO: submit posts to /api/runs, which resolves the commit SHA and returns a
 * runId; push to `/runs/${runId}/start`. Until that route exists this walks to
 * the demo run so the flow stays clickable.
 */
export function RepoEntryForm() {
  const [repo, setRepo] = useState("");
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/runs/${DEMO_RUN_ID}/start`);
      }}
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
      <button type="submit" className="btn-pixel btn-gold">
        LET&rsquo;S PLAY <Play className="text-xs" />
      </button>
    </form>
  );
}
