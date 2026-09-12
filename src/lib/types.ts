/**
 * Domain types shared by the UI and (later) the pipeline routes.
 *
 * These mirror the tables in docs/TechDesign-ReadyPlayerOne-MVP.md. Zod
 * schemas that validate route boundaries and model JSON belong in
 * src/lib/schemas.ts once those routes exist; these are the plain shapes the
 * screens render.
 */

export type Topic =
  | "file_structure"
  | "core_logic"
  | "apis"
  | "testing"
  | "deployment";

export const TOPIC_LABELS: Record<Topic, string> = {
  file_structure: "File Structure",
  core_logic: "Core Logic",
  apis: "APIs",
  testing: "Testing",
  deployment: "Deployment",
};

export const TOPIC_ORDER: Topic[] = [
  "file_structure",
  "core_logic",
  "apis",
  "testing",
  "deployment",
];

export type RunStatus =
  | "pending"
  | "indexing"
  | "generating"
  | "ready"
  | "complete"
  | "failed";

/** A file+line span in the ingested snapshot. Never rendered unverified. */
export type Citation = {
  path: string;
  startLine: number;
  endLine: number;
};

export type QuestionOption = {
  /** "A" | "B" | "C" | "D" as shown in the mockups. */
  label: string;
  text: string;
  explanation: string;
  citation: Citation | null;
  /** False once a citation fails verification and is stripped. */
  verified: boolean;
};

export type Question = {
  id: string;
  orderIndex: number;
  topic: Topic;
  prompt: string;
  options: QuestionOption[];
  correctIndex: number;
};

export type Answer = {
  questionId: string;
  selectedIndex: number | null;
  isCorrect: boolean;
  streakAtAnswer: number;
};

export type Run = {
  id: string;
  owner: string;
  repo: string;
  commitSha: string;
  status: RunStatus;
  questionCount: number;
  heartsRemaining: number;
  completedAt: string | null;
  createdAt: string;
};

/** Progress reported by the ingestion batch route, rendered on /runs/:id. */
export type IngestStage = "fetching" | "indexing" | "generating" | "ready";

export type StageDetail = {
  stage: IngestStage;
  filesTotal: number;
  filesIndexed: number;
  chunkCount: number;
  skipped: number;
};

/** Builds the permalink pinned to the ingested commit, per the tech design. */
export function citationUrl(
  owner: string,
  repo: string,
  commitSha: string,
  citation: Citation,
): string {
  return `https://github.com/${owner}/${repo}/blob/${commitSha}/${citation.path}#L${citation.startLine}-L${citation.endLine}`;
}

/** Renders a citation as `path:start–end` (en dash, as specified). */
export function citationLabel(citation: Citation): string {
  return `${citation.path}:${citation.startLine}\u2013${citation.endLine}`;
}
