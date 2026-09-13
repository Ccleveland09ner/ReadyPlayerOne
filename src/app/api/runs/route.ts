import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorResponse } from "@/lib/api";
import { log, timed } from "@/lib/log";
import {
  RUN_CREATE_LIMIT,
  RUN_CREATE_WINDOW_MS,
  clientKey,
  rateLimit,
} from "@/lib/ratelimit";
import {
  MIN_SOURCE_FILES,
  fetchHeadSha,
  fetchRepoMeta,
  fetchTree,
  parseRepoUrl,
  selectFiles,
} from "@/lib/github";
import { requireAnonId } from "@/lib/identity";
import { currentUser } from "@/lib/auth/session";
import { createRunInput } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/runs -- create a run.
 *
 * Resolves the repository to a specific commit SHA, which is what makes every
 * downstream citation verifiable and every repeat run cacheable. Then fetches
 * the tree, filters it to meaningful source under hard caps, and records the
 * manifest the citation verifier checks against.
 *
 * Request:  { repoUrl: string }
 * Response: { runId, owner, repo, commitSha, fileCount, cached }
 */
/**
 * Two GitHub calls and a tree fetch. Comfortably fast, but a large
 * repository's tree is not free, so the window is stated rather than inherited.
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Creating runs is the route that costs GitHub quota and embedding
    // credits, so it is the one that gets a per-caller limit.
    const limit = rateLimit(
      `runs:${clientKey(request)}`,
      RUN_CREATE_LIMIT,
      RUN_CREATE_WINDOW_MS,
    );
    if (!limit.ok) {
      log.warn("ratelimit.block", { route: "runs", retryAfterMs: limit.retryAfterMs });
      return apiError(
        "rate_limited",
        "That is a lot of repositories in a short time. Give it a minute.",
        { retryAfterMs: limit.retryAfterMs },
      );
    }

    const body = await request.json().catch(() => null);
    const parsedBody = createRunInput.safeParse(body);
    if (!parsedBody.success) {
      return apiError("bad_request", "Send a repository URL.");
    }

    const parsed = parseRepoUrl(parsedBody.data.repoUrl);
    if (!parsed) {
      return apiError(
        "bad_request",
        "That does not look like a GitHub repository. Try https://github.com/owner/repo.",
      );
    }

    const { owner, repo } = parsed;
    const anonId = await requireAnonId();
    // Stamp the account too when there is one. Without this a signed-in
    // player's runs are tied to the browser alone: they survive a logout on
    // that machine and vanish on any other, which is the opposite of what
    // having an account is for. `anon_id` still goes on every run so the
    // claim-on-sign-in path keeps working for anonymous play.
    const user = await currentUser();
    const supabase = createServiceClient();

    // 404 covers both private and nonexistent; fetchRepoMeta says so honestly.
    const { defaultBranch } = await timed("run.create", { owner, repo }, () =>
      fetchRepoMeta(owner, repo),
    );
    const commitSha = await fetchHeadSha(owner, repo, defaultBranch);

    // Snapshot cache: reuse the chunks, but always as a NEW run for this
    // player. Handing back someone else's attempt would show their answers.
    const { data: cached } = await supabase
      .from("runs")
      .select("id")
      .eq("owner", owner)
      .eq("repo", repo)
      .eq("commit_sha", commitSha)
      .is("snapshot_run_id", null)
      .in("status", ["ready", "complete"])
      .limit(1)
      .maybeSingle();

    if (cached) {
      const { count } = await supabase
        .from("repo_files")
        .select("id", { count: "exact", head: true })
        .eq("run_id", cached.id)
        .eq("included", true);

      // Questions are regenerated per attempt -- one model call, and a retake
      // is not the same five questions.
      const { data: run, error } = await supabase
        .from("runs")
        .insert({
          owner,
          repo,
          commit_sha: commitSha,
          default_branch: defaultBranch,
          snapshot_run_id: cached.id,
          status: "generating",
          anon_id: anonId,
          user_id: user?.id ?? null,
          stage_detail: {
            stage: "generating",
            filesTotal: count ?? 0,
            filesIndexed: count ?? 0,
            cached: true,
          },
        })
        .select("id")
        .single();

      if (error) throw new Error(`Could not create run: ${error.message}`);

      log.info("run.cached", {
        runId: run.id,
        owner,
        repo,
        commitSha,
        snapshotRunId: cached.id,
      });

      return NextResponse.json({
        runId: run.id,
        owner,
        repo,
        commitSha,
        fileCount: count ?? 0,
        cached: true,
      });
    }

    const { entries, truncated } = await timed(
      "ingest.tree",
      { owner, repo, commitSha },
      () => fetchTree(owner, repo, commitSha),
    );
    const files = selectFiles(entries);
    const included = files.filter((file) => file.included);

    log.info("ingest.file_skip", {
      owner,
      repo,
      total: files.length,
      included: included.length,
      skipped: files.length - included.length,
      treeTruncated: truncated,
    });

    if (included.length < MIN_SOURCE_FILES) {
      return apiError(
        "repo_too_small",
        `Only ${included.length} readable source files were found in ${owner}/${repo}. That is not enough to build a quiz worth taking.`,
        { included: included.length, required: MIN_SOURCE_FILES },
      );
    }

    const { data: run, error: runError } = await supabase
      .from("runs")
      .insert({
        owner,
        repo,
        commit_sha: commitSha,
        default_branch: defaultBranch,
        status: "indexing",
        anon_id: anonId,
        user_id: user?.id ?? null,
        stage_detail: {
          stage: "fetching",
          filesTotal: included.length,
          filesIndexed: 0,
          chunkCount: 0,
          skipped: files.length - included.length,
          treeTruncated: truncated,
        },
      })
      .select("id")
      .single();

    if (runError) throw new Error(`Could not create run: ${runError.message}`);

    // The manifest is what the verifier checks paths against, so every file is
    // recorded -- skipped ones carry the reason they were skipped.
    const { error: filesError } = await supabase.from("repo_files").insert(
      files.map((file) => ({
        run_id: run.id,
        path: file.path,
        byte_size: file.byteSize,
        included: file.included,
        skip_reason: file.skipReason,
      })),
    );

    if (filesError) {
      throw new Error(`Could not record the file manifest: ${filesError.message}`);
    }

    log.info("run.create", {
      runId: run.id,
      owner,
      repo,
      commitSha,
      fileCount: included.length,
    });

    return NextResponse.json({
      runId: run.id,
      owner,
      repo,
      commitSha,
      fileCount: included.length,
      cached: false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
