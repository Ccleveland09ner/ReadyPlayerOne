import { NextResponse } from "next/server";
import { generateQuiz, type RepoMap } from "@/lib/quiz/generate";
import { verifyCitation, type RetrievedSpan, type SnapshotFiles } from "@/lib/quiz/verify";
import { failRun, loadRun, snapshotIdOf, updateRun } from "@/lib/runs";
import { apiError, errorResponse } from "@/lib/api";
import { MODEL_BUDGET, consumeBudget } from "@/lib/ratelimit";
import { log, timed } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/service";
import type { QuestionOption, Topic } from "@/lib/types";

/**
 * POST /api/runs/:runId/questions -- generate the five questions.
 *
 * One model call, then mechanical verification of everything it claimed.
 *
 * If the CORRECT option's citation fails verification, the whole quiz is
 * regenerated once; if it fails again the run fails. Nothing here ever ships
 * an uncited answer key -- that rule is the product.
 */

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  try {
    const run = await loadRun(runId);
    if (!run) return apiError("not_found", "Run not found.");

    // Already generated: idempotent, so a double-tap cannot bill twice.
    const supabase = createServiceClient();
    const { count: existing } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId);

    if ((existing ?? 0) > 0) {
      return NextResponse.json({ questionCount: existing, regenerated: false });
    }

    const snapshotId = snapshotIdOf(run);
    const map = await buildRepoMap(run.owner, run.repo, snapshotId);
    const snapshotFiles = await loadSnapshotFiles(snapshotId);

    let lastFailure = "";

    // One retry. Generic filler is worse than an error, so the second failure
    // fails the run rather than shipping something hollow.
    for (let attempt = 1; attempt <= 2; attempt++) {
      // One generation call per quiz is the design; a budget here catches a
      // retry loop that has gone wrong before it bills for it.
      consumeBudget("model", MODEL_BUDGET);

      const { quiz, retrievedByTopic } = await timed(
        "generate.call",
        { runId, attempt },
        () => generateQuiz(snapshotId, map),
      );

      let rejectedCitations = 0;
      let uncitedAnswerKey = false;

      const rows = quiz.questions.map((question, orderIndex) => {
        const retrieved: RetrievedSpan[] = (
          retrievedByTopic[question.topic as Topic] ?? []
        ).map((chunk) => ({
          filePath: chunk.file_path,
          startLine: chunk.start_line,
          endLine: chunk.end_line,
        }));

        const options: QuestionOption[] = question.options.map((option, i) => {
          if (!option.citation) {
            return { ...option, citation: null, verified: false };
          }

          const result = verifyCitation(option.citation, snapshotFiles, retrieved);
          if (result.ok) {
            return { ...option, citation: option.citation, verified: true };
          }

          // Stripped, not shown. A failed citation on a wrong option just
          // makes it low-confidence; on the correct one it fails the quiz.
          rejectedCitations += 1;
          if (i === question.correctIndex) uncitedAnswerKey = true;
          return { ...option, citation: null, verified: false };
        });

        return {
          run_id: runId,
          order_index: orderIndex,
          topic: question.topic,
          prompt: question.prompt,
          options,
          correct_index: question.correctIndex,
        };
      });

      log.info("generate.verify", { runId, attempt, rejectedCitations, uncitedAnswerKey });

      if (uncitedAnswerKey) {
        log.warn("generate.reject", { runId, attempt });
        lastFailure =
          "A correct answer lost its citation to verification, so the quiz was rejected.";
        continue;
      }

      const { error: insertError } = await supabase.from("questions").insert(rows);
      if (insertError) {
        throw new Error(`Could not store questions: ${insertError.message}`);
      }

      await updateRun(runId, {
        status: "ready",
        error: null,
        stage_detail: {
          ...run.stage_detail,
          stage: "ready",
          rejectedCitations,
          generationAttempts: attempt,
        },
      });

      log.info("generate.done", {
        runId,
        questions: rows.length,
        rejectedCitations,
        attempt,
      });

      return NextResponse.json({
        questionCount: rows.length,
        rejectedCitations,
        regenerated: attempt > 1,
      });
    }

    await failRun(runId, lastFailure);
    return apiError("generation_failed", lastFailure);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Question generation failed.";
    await failRun(runId, message).catch(() => {});
    return errorResponse(error, { runId });
  }
}

/** `path -> line count` for every included file in the snapshot. */
async function loadSnapshotFiles(snapshotId: string): Promise<SnapshotFiles> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("repo_files")
    .select("path, line_count")
    .eq("run_id", snapshotId)
    .eq("included", true);

  const files: SnapshotFiles = new Map();
  for (const row of data ?? []) {
    if (typeof row.line_count === "number") files.set(row.path, row.line_count);
  }
  return files;
}

/**
 * Structural digest of the snapshot: tree, stack, dependencies, entry points.
 *
 * The dependency list matters more than it looks -- it is what lets the model
 * write wrong options naming real tools this project actually uses, which is
 * the difference between a quiz that feels real and one that does not.
 */
async function buildRepoMap(
  owner: string,
  repo: string,
  snapshotId: string,
): Promise<RepoMap> {
  const supabase = createServiceClient();

  const { data: files } = await supabase
    .from("repo_files")
    .select("path")
    .eq("run_id", snapshotId)
    .eq("included", true)
    .order("path");

  const paths = (files ?? []).map((file) => file.path);

  const { data: manifestChunks } = await supabase
    .from("chunks")
    .select("file_path, content")
    .eq("run_id", snapshotId)
    .in("file_path", [
      "package.json",
      "pyproject.toml",
      "requirements.txt",
      "go.mod",
      "Cargo.toml",
      "composer.json",
    ]);

  const dependencies = new Set<string>();
  for (const chunk of manifestChunks ?? []) {
    for (const name of parseDependencies(chunk.file_path, chunk.content)) {
      dependencies.add(name);
    }
  }

  const byExtension = new Map<string, number>();
  for (const path of paths) {
    const ext = path.split(".").pop();
    if (ext && ext !== path) {
      byExtension.set(ext, (byExtension.get(ext) ?? 0) + 1);
    }
  }
  const primaryLanguage =
    [...byExtension.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const entryPoints = paths.filter((path) => {
    const name = path.split("/").pop()?.toLowerCase() ?? "";
    return ["index.", "main.", "app.", "server.", "cli.", "__main__."].some(
      (hint) => name.startsWith(hint),
    );
  });

  return {
    owner,
    repo,
    tree: paths,
    primaryLanguage,
    dependencies: [...dependencies],
    entryPoints: entryPoints.slice(0, 10),
  };
}

function parseDependencies(path: string, content: string): string[] {
  try {
    if (path === "package.json" || path === "composer.json") {
      const json = JSON.parse(content) as Record<string, unknown>;
      return [
        ...Object.keys((json.dependencies as object) ?? {}),
        ...Object.keys((json.devDependencies as object) ?? {}),
        ...Object.keys((json.require as object) ?? {}),
      ];
    }
    if (path === "requirements.txt") {
      return content
        .split("\n")
        .map((line) => line.trim().split(/[<>=!\[;#]/)[0].trim())
        .filter(Boolean);
    }
    if (path === "go.mod") {
      return [...content.matchAll(/^\s+([\w./-]+)\s+v/gm)].map((m) => m[1]);
    }
    if (path === "pyproject.toml" || path === "Cargo.toml") {
      return [...content.matchAll(/^([\w-]+)\s*=/gm)].map((m) => m[1]);
    }
  } catch {
    // A manifest we cannot parse just means fewer distractor names.
  }
  return [];
}
