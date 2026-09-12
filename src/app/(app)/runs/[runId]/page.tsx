import { notFound, redirect } from "next/navigation";
import { Panel } from "@/components/ui/Panel";
import { loadRun } from "@/lib/runs";
import type { StageDetail } from "@/lib/types";
import { IngestProgress } from "./ingest-progress";

/** Screen 6 — staged ingestion progress. Redirects to the quiz when ready. */
export default async function RunPage({ params }: PageProps<"/runs/[runId]">) {
  const { runId } = await params;

  const run = await loadRun(runId);
  if (!run) notFound();

  if (run.status === "ready" || run.status === "complete") {
    redirect(run.completed_at ? `/runs/${runId}/complete` : `/runs/${runId}/quiz`);
  }

  const stage = run.stage_detail as Partial<StageDetail>;
  const initial: StageDetail = {
    stage: stage.stage ?? "fetching",
    filesTotal: stage.filesTotal ?? 0,
    filesIndexed: stage.filesIndexed ?? 0,
    chunkCount: stage.chunkCount ?? 0,
    skipped: stage.skipped ?? 0,
  };

  return (
    <Panel className="max-w-3xl p-6 sm:p-9">
      <div className="text-center">
        <h1 className="text-pixel text-2xl text-white sm:text-3xl">READING THE REPO</h1>
        <p className="text-pixel mt-3 text-[10px] leading-relaxed tracking-wide text-[#8fa0e6]">
          THIS IS THE ONLY WAIT. STAY ON THIS SCREEN.
        </p>
      </div>

      {run.status === "failed" ? (
        <p className="text-display mt-8 text-center text-base font-medium text-[#ff5470]">
          {run.error ?? "This run failed."}
        </p>
      ) : (
        <IngestProgress runId={runId} initial={initial} />
      )}
    </Panel>
  );
}
