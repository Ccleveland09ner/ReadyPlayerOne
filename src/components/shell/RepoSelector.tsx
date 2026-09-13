"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { BranchIcon, ChevronDown } from "@/components/ui/Icons";

export type RecentRepo = { owner: string; repo: string; runId: string };

/**
 * The repository selector in the top bar.
 *
 * Picking a repository starts a NEW run against it rather than reopening the
 * old one: an old run is finished, and its questions are already answered.
 * Because the snapshot is cached by commit SHA, `POST /api/runs` reuses the
 * chunks and comes back in about a second, so the player drops into the normal
 * confirm -> ingest -> quiz workflow with no re-ingestion.
 *
 * If the repository has moved on since, the SHA differs, the cache misses and
 * it ingests again. That is correct: questions must describe the commit they
 * were generated from.
 */
export function RepoSelector({
  owner,
  repo,
  recent,
}: {
  owner: string | null;
  repo: string | null;
  recent: RecentRepo[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Without both, the panel sits over the
  // quiz and swallows the next thing the player tries to press.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function start(target: RecentRepo) {
    if (starting) return;
    setStarting(`${target.owner}/${target.repo}`);
    setError(null);

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: `${target.owner}/${target.repo}` }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? "Could not start that repository.");
        setStarting(null);
        return;
      }

      setOpen(false);
      router.push(`/runs/${payload.runId}/start`);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setStarting(null);
    }
  }

  const label = repo ? `${owner} / ${repo}` : "Select a repository…";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={recent.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="box-8bit flex min-w-[220px] items-center gap-3 px-4 py-3 text-left transition hover:brightness-105 disabled:cursor-default sm:min-w-[340px]"
        style={PARCHMENT}
      >
        <BranchIcon className="text-xl text-[#5b3fd6]" />
        <span className="text-pixel text-ink flex-1 text-[11px] tracking-wide">
          {repo ? (
            <>
              <span style={{ color: "#7b76ad" }}>{owner}</span> / {repo}
            </>
          ) : (
            <span style={{ color: "#7b76ad" }}>{label}</span>
          )}
        </span>
        <ChevronDown
          className={`text-lg text-[#6f68a8] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Recent repositories"
          className="box-8bit absolute top-full left-0 z-50 mt-2 w-full min-w-[220px] p-2 sm:min-w-[340px]"
          style={PARCHMENT}
        >
          <p className="text-pixel px-2 py-1 text-[8px] tracking-wide text-[#7b76ad]">
            RECENT REPOSITORIES
          </p>

          {recent.map((item) => {
            const key = `${item.owner}/${item.repo}`;
            const isCurrent = item.owner === owner && item.repo === repo;
            const isStarting = starting === key;

            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => start(item)}
                disabled={starting !== null}
                className="chip-8bit text-pixel mt-1 flex w-full items-center gap-2 px-2 py-2 text-left text-[10px] tracking-wide transition hover:brightness-95 disabled:opacity-60"
                style={
                  {
                    "--chip-bg": isCurrent ? "#dfe2f4" : "transparent",
                    "--chip-edge": isCurrent ? "#6d4aff" : "#c2c6e2",
                  } as CSSProperties
                }
              >
                <BranchIcon className="shrink-0 text-base text-[#5b3fd6]" />
                <span className="text-ink flex-1 truncate">
                  <span style={{ color: "#7b76ad" }}>{item.owner}</span> / {item.repo}
                </span>
                <span className="shrink-0 text-[8px] text-[#6d4aff]">
                  {isStarting ? "STARTING…" : "PLAY"}
                </span>
              </button>
            );
          })}

          {error ? (
            <p role="alert" className="text-pixel mt-2 px-2 py-1 text-[9px] leading-relaxed text-[#c0392b]">
              {error}
            </p>
          ) : null}

          <p className="text-pixel mt-2 px-2 py-1 text-[8px] leading-relaxed text-[#7b76ad]">
            Starts a fresh quiz. Already-read repositories reuse their snapshot,
            so they begin in seconds.
          </p>
        </div>
      ) : null}
    </div>
  );
}

const PARCHMENT = {
  "--box-bg": "var(--color-parchment)",
  "--box-edge": "#c2c6e2",
  "--box-hi": "rgba(255,255,255,0.85)",
  "--box-lo": "rgba(0,0,0,0.12)",
} as CSSProperties;
