"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { IngestStage, StageDetail } from "@/lib/types";

const STAGES: { id: IngestStage; label: string; detail: (s: StageDetail) => string }[] = [
  {
    id: "fetching",
    label: "FETCHING REPOSITORY",
    detail: (s) => `${s.filesTotal} files found, ${s.skipped} skipped`,
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
 * TODO: replace the simulated ticker with the real client-orchestrated loop —
 * POST /api/runs/:id/index until filesRemaining is 0, then POST
 * /api/runs/:id/questions, rendering stage_detail from each response.
 */
export function IngestProgress({ runId }: { runId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<StageDetail>({
    stage: "fetching",
    filesTotal: 48,
    filesIndexed: 0,
    chunkCount: 0,
    skipped: 212,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setDetail((d) => {
        if (d.filesIndexed >= d.filesTotal) {
          return { ...d, stage: "generating" };
        }
        const filesIndexed = Math.min(d.filesTotal, d.filesIndexed + 8);
        return {
          ...d,
          stage: "indexing",
          filesIndexed,
          chunkCount: filesIndexed * 7,
        };
      });
    }, 700);
    return () => clearInterval(timer);
  }, []);

  const activeIndex = STAGES.findIndex((s) => s.id === detail.stage);

  return (
    <>
      <ol className="mt-8 flex flex-col gap-3">
        {STAGES.map((stage, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={stage.id}
              className="flex items-center gap-4 rounded-lg px-4 py-4"
              style={{
                border: `2px solid ${active ? "var(--color-grape)" : done ? "rgba(74,222,128,0.5)" : "#241f52"}`,
                background: active ? "rgba(124,92,255,0.14)" : "rgba(24,20,64,0.55)",
              }}
            >
              <span className="text-pixel text-lg" style={{ color: done ? "var(--color-lime)" : active ? "#fff" : "#5a5588" }}>
                {done ? "✓" : active ? "▶" : "·"}
              </span>
              <span className="flex-1">
                <span className="text-pixel block text-[11px] text-white">{stage.label}</span>
                <span className="text-display mt-1 block text-sm text-[#b7b2e6]">
                  {done || active ? stage.detail(detail) : "waiting"}
                </span>
              </span>
              {active ? <span className="text-pixel animate-blink text-[10px] text-[#46c8ff]">WORKING</span> : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 h-3 overflow-hidden rounded-full" style={{ background: "#241f52" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.round((detail.filesIndexed / detail.filesTotal) * 100)}%`,
            background: "linear-gradient(90deg,#7c5cff,#46c8ff)",
          }}
        />
      </div>

      <div className="mt-7 flex justify-center">
        <button
          type="button"
          onClick={() => router.push(`/runs/${runId}/quiz`)}
          className="btn-pixel btn-gold"
        >
          SKIP TO QUIZ (SKELETON)
        </button>
      </div>
    </>
  );
}
