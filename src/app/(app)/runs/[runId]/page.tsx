import { Panel } from "@/components/ui/Panel";
import { IngestProgress } from "./ingest-progress";

/** Screen 6 — staged ingestion progress. Redirects to the quiz when ready. */
export default async function RunPage({ params }: PageProps<"/runs/[runId]">) {
  const { runId } = await params;

  return (
    <Panel className="max-w-3xl p-6 sm:p-9">
      <div className="text-center">
        <h1 className="text-pixel text-2xl text-white sm:text-3xl">READING THE REPO</h1>
        <p className="text-pixel mt-3 text-[10px] leading-relaxed tracking-wide text-[#8fa0e6]">
          THIS IS THE ONLY WAIT. STAY ON THIS SCREEN.
        </p>
      </div>
      <IngestProgress runId={runId} />
    </Panel>
  );
}
