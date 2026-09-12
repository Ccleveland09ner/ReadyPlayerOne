import { NextResponse } from "next/server";

/**
 * POST /api/runs — create a run.
 *
 * Not implemented yet. See docs/TechDesign-ReadyPlayerOne-MVP.md,
 * "Repository Ingestion":
 *   1. parse owner/repo from a full URL or shorthand, reject non-GitHub hosts
 *   2. GET /repos/{owner}/{repo} for the default branch and existence check
 *   3. GET /repos/{owner}/{repo}/commits/{branch} to pin the commit SHA
 *   4. return the cached snapshot run if one is ready for that SHA
 *   5. GET the recursive tree, filter, cap at 60 files / 400KB
 *   6. write repo_files with included/skip_reason, create the run row
 *
 * Request:  { repoUrl: string }
 * Response: { runId, owner, repo, commitSha, fileCount, cached }
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented: repository ingestion (Feature 1)." },
    { status: 501 },
  );
}
