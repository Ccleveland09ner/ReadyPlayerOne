import { NextResponse } from "next/server";

/**
 * POST /api/runs/:runId/index — chunk and embed one batch of files.
 *
 * Not implemented yet. The client calls this repeatedly until filesRemaining
 * is 0; batching is what keeps each request inside the serverless execution
 * ceiling and what gives the progress screen something real to show.
 *
 * Chunking: files under 40 lines become one chunk, otherwise 60-line windows
 * with 10-line overlap. start_line and end_line are 1-based and must match the
 * source exactly — every citation in the product depends on it.
 *
 * Request:  { batchSize?: number }  (default 8)
 * Response: { filesIndexed, filesRemaining, chunkCount }
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented: chunk + embed batch (Feature 2)." },
    { status: 501 },
  );
}
