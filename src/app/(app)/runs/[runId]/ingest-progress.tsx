"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Check, Play } from "@/components/ui/Icons";
import { postJson } from "@/lib/api-client";
import type { IngestStage, StageDetail } from "@/lib/types";

type IndexBatch = { done: boolean; filesRemaining?: number; chunkCount?: number };

const STAGES: { id: IngestStage; label: string; detail: (s: StageDetail) => string }[] = [
  {
    id: "fetching",
    label: "FETCHING REPOSITORY",
    detail: (s) => `${s.filesTotal} files kept, ${s.skipped} skipped`,
  },
  {
    id: "indexing",
    label: "INDEXING SOURCE",
    detail: (s) => `${s.filesIndexed} / ${s.filesTotal} files, ${s.chunkCount} chunks`,
  },
  {
    id: "generating",
    label: "GENERATING QUESTIONS",
    detail: () => "five topics, cited and verified",
  },
];

/**
 * Screen 6 — the only screen a judge waits on, so it reports what it is doing
 * rather than spinning.
 *
 * The client is the orchestrator. It loops POST /api/runs/:id/index until the
 * server reports the queue is drained, then calls /questions once. This exists
 * for one hard reason: serverless functions have an execution ceiling and
 * ingesting a repo does not fit inside it. Batching per request also gives
 * this screen something real to display.
 *
 * Navigating away abandons the run. Acceptable — ingestion is under 90
 * seconds and this screen gives you a reason to stay.
 */
export function IngestProgress({
  runId,
  initial,
}: {
  runId: string;
  initial: StageDetail;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<StageDetail>(initial);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // React 18+ runs effects twice in development; the pipeline must not.
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    async function run() {
      try {
        // Index in batches until the queue drains. One retry per batch, then
        // the run fails rather than hanging on this screen forever.
        for (let guard = 0; guard < 60; guard++) {
          if (cancelled) return;

          let batch;
          try {
            batch = await postJson<IndexBatch>(`/api/runs/${runId}/index`);
          } catch {
            batch = await postJson<IndexBatch>(`/api/runs/${runId}/index`);
          }

          if (cancelled) return;

          setDetail((current) => ({
            ...current,
            stage: batch.done ? "generating" : "indexing",
            filesIndexed: current.filesTotal - (batch.filesRemaining ?? 0),
            chunkCount: batch.chunkCount ?? current.chunkCount,
          }));

          if (batch.done) break;
        }

        if (cancelled) return;
        setDetail((current) => ({ ...current, stage: "generating" }));

        await postJson(`/api/runs/${runId}/questions`);
        if (cancelled) return;

        router.push(`/runs/${runId}/quiz`);
        router.refresh();
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : "Ingestion failed.",
        );
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [runId, router]);

  const activeIndex = STAGES.findIndex((s) => s.id === detail.stage);
  const percent =
    detail.filesTotal > 0
      ? Math.round((detail.filesIndexed / detail.filesTotal) * 100)
      : 0;

  return (
    <>
      <ol className="mt-8 flex flex-col gap-3">
        {STAGES.map((stage, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex && !error;
          return (
            <li
              key={stage.id}
              className="box-8bit flex items-center gap-4 px-4 py-4"
              style={
                {
                  "--box-edge": active
                    ? "var(--color-grape)"
                    : done
                      ? "rgba(74,222,128,0.5)"
                      : "#241f52",
                  "--box-bg": active ? "rgba(124,92,255,0.14)" : "rgba(24,20,64,0.55)",
                } as CSSProperties
              }
            >
              <span className="text-pixel text-lg" style={{ color: done ? "var(--color-lime)" : active ? "#fff" : "#5a5588" }}>
                {done ? <Check /> : active ? <Play /> : <span className="inline-block h-2 w-2 bg-current align-middle" />}
              </span>
              <span className="flex-1">
                <span className="text-pixel block text-[11px] text-white">{stage.label}</span>
                <span className="text-pixel mt-2 block text-[10px] leading-relaxed text-[#b7b2e6]">
                  {done || active ? stage.detail(detail) : "waiting"}
                </span>
              </span>
              {active ? <span className="text-pixel animate-blink text-[10px] text-[#46c8ff]">WORKING</span> : null}
            </li>
          );
        })}
      </ol>

      <div className="meter-8bit mt-6 h-3 overflow-hidden" style={{ background: "#241f52" }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${percent}%`,
            background: "linear-gradient(90deg,#7c5cff,#46c8ff)",
          }}
        />
      </div>

      {error ? (
        <div className="mt-7 text-center">
          <p className="text-pixel text-[10px] leading-relaxed text-[#ff5470]">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="btn-pixel btn-8bit btn-ghost mt-4"
          >
            TRY ANOTHER REPOSITORY
          </button>
        </div>
      ) : null}
    </>
  );
}
