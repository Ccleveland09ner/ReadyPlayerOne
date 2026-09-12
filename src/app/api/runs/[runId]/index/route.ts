import { NextResponse, type NextRequest } from "next/server";
import { fetchBlob, languageOf } from "@/lib/github";
import { chunkFile, countLines } from "@/lib/index/chunk";
import { MAX_EMBEDDING_CALLS_PER_RUN, embedBatch } from "@/lib/index/embed";
import { indexBatchInput } from "@/lib/schemas";
import { failRun, loadRun, snapshotIdOf, updateRun } from "@/lib/runs";
import { apiError, errorResponse } from "@/lib/api";
import { log, timed } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/runs/:runId/index -- chunk and embed one batch of files.
 *
 * The client calls this repeatedly until `filesRemaining` is 0. Batching is
 * what keeps each request inside the serverless execution ceiling, and it is
 * what gives the progress screen something real to show.
 *
 * If a batch of 8 runs long on large files, lower DEFAULT_BATCH_SIZE -- it is
 * a single constant on purpose.
 *
 * Request:  { batchSize?: number }
 * Response: { filesIndexed, filesRemaining, chunkCount, done }
 */

const DEFAULT_BATCH_SIZE = 8;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  try {
    const run = await loadRun(runId);
    if (!run) return apiError("not_found", "Run not found.");

    // A cached run borrows another run's chunks; there is nothing to index.
    if (run.snapshot_run_id) {
      return NextResponse.json({
        filesIndexed: 0,
        filesRemaining: 0,
        chunkCount: 0,
        done: true,
      });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = indexBatchInput.safeParse(body ?? {});
    const batchSize = parsed.success
      ? (parsed.data.batchSize ?? DEFAULT_BATCH_SIZE)
      : DEFAULT_BATCH_SIZE;

    const snapshotId = snapshotIdOf(run);
    const supabase = createServiceClient();

    // A file is indexed once it has a line_count. Cheap resume marker: a
    // retried batch picks up exactly where the failed one stopped.
    const { data: pending, error: pendingError } = await supabase
      .from("repo_files")
      .select("id, path, byte_size")
      .eq("run_id", snapshotId)
      .eq("included", true)
      .is("line_count", null)
      .order("path")
      .limit(batchSize);

    if (pendingError) {
      throw new Error(`Could not read the manifest: ${pendingError.message}`);
    }

    const batch = pending ?? [];

    if (batch.length === 0) {
      const { count: chunkCount } = await supabase
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("run_id", snapshotId);

      await updateRun(runId, {
        status: "generating",
        stage_detail: {
          ...run.stage_detail,
          stage: "generating",
          chunkCount: chunkCount ?? 0,
        },
      });

      return NextResponse.json({
        filesIndexed: 0,
        filesRemaining: 0,
        chunkCount: chunkCount ?? 0,
        done: true,
      });
    }

    // Guard against a pathological repo draining embedding credits.
    const callsSoFar = Number(run.stage_detail?.embeddingCalls ?? 0);
    if (callsSoFar >= MAX_EMBEDDING_CALLS_PER_RUN) {
      await failRun(
        runId,
        "This repository needed more embedding calls than the per-run cap allows.",
      );
      return apiError(
        "rate_limited",
        "This repository needed more embedding calls than the per-run cap allows.",
        { cap: MAX_EMBEDDING_CALLS_PER_RUN },
      );
    }

    // Fetch and chunk the batch, then embed all of its chunks in one call.
    const chunkRows: {
      run_id: string;
      file_path: string;
      start_line: number;
      end_line: number;
      content: string;
      language: string | null;
    }[] = [];
    const lineCounts: { id: string; lines: number }[] = [];

    for (const file of batch) {
      let text: string;
      try {
        text = await fetchBlob(run.owner, run.repo, run.commit_sha, file.path);
      } catch {
        // One unreadable file should not sink the run. Mark it excluded so the
        // verifier will not accept citations into it, and move on.
        await supabase
          .from("repo_files")
          .update({ included: false, skip_reason: "fetch_failed", line_count: 0 })
          .eq("id", file.id);
        continue;
      }

      lineCounts.push({ id: file.id, lines: countLines(text) });

      for (const chunk of chunkFile(file.path, text)) {
        chunkRows.push({
          run_id: snapshotId,
          file_path: chunk.filePath,
          start_line: chunk.startLine,
          end_line: chunk.endLine,
          content: chunk.content,
          language: languageOf(chunk.filePath),
        });
      }
    }

    if (chunkRows.length > 0) {
      const vectors = await timed(
        "embed.batch",
        { runId, chunks: chunkRows.length },
        () =>
          embedBatch(
            chunkRows.map(
              (chunk) => `${chunk.file_path}:${chunk.start_line}\n${chunk.content}`,
            ),
          ),
      );

      const { error: insertError } = await supabase.from("chunks").insert(
        chunkRows.map((chunk, i) => ({
          ...chunk,
          embedding: JSON.stringify(vectors[i]),
        })),
      );

      if (insertError) {
        throw new Error(`Could not store chunks: ${insertError.message}`);
      }
    }

    // Only mark files indexed after their chunks landed, so a failed insert
    // leaves them to be retried rather than silently skipped.
    for (const entry of lineCounts) {
      await supabase
        .from("repo_files")
        .update({ line_count: entry.lines })
        .eq("id", entry.id);
    }

    const { count: remaining } = await supabase
      .from("repo_files")
      .select("id", { count: "exact", head: true })
      .eq("run_id", snapshotId)
      .eq("included", true)
      .is("line_count", null);

    const { count: chunkCount } = await supabase
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("run_id", snapshotId);

    const filesRemaining = remaining ?? 0;
    const done = filesRemaining === 0;

    await updateRun(runId, {
      status: done ? "generating" : "indexing",
      stage_detail: {
        ...run.stage_detail,
        stage: done ? "generating" : "indexing",
        filesIndexed:
          Number(run.stage_detail?.filesIndexed ?? 0) + lineCounts.length,
        chunkCount: chunkCount ?? 0,
        embeddingCalls: callsSoFar + (chunkRows.length > 0 ? 1 : 0),
      },
    });

    log.info("ingest.batch", {
      runId,
      filesIndexed: lineCounts.length,
      filesRemaining,
      chunkCount: chunkCount ?? 0,
      done,
    });
    if (done) log.info("ingest.done", { runId, chunkCount: chunkCount ?? 0 });

    return NextResponse.json({
      filesIndexed: lineCounts.length,
      filesRemaining,
      chunkCount: chunkCount ?? 0,
      done,
    });
  } catch (error) {
    return errorResponse(error, { runId });
  }
}
