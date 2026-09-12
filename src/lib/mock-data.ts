/**
 * PLACEHOLDER CONTENT — transcribed from the reference screens so every
 * screen renders before the pipeline exists.
 *
 * Each export below is replaced by a real query as its feature lands:
 *   MOCK_QUIZ    -> questions generated for the run (Feature 3)
 *   MOCK_HISTORY -> src/lib/history (paginated runs for this player)
 *   MOCK_REPORT* -> src/lib/history (aggregate query over answers)
 * Nothing here should survive into the submission.
 */

import type { Question, Topic } from "@/lib/types";
import type { MasteryTone } from "@/lib/progression/mastery";

export const MOCK_REPO = { owner: "AcmeCorp", repo: "onboarding" };

/** Run id the skeleton links to so the quiz flow is clickable without a pipeline. */
export const DEMO_RUN_ID = "demo";

export const MOCK_COMMIT_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

function opt(
  label: string,
  text: string,
  explanation: string,
  citation: { path: string; startLine: number; endLine: number } | null,
) {
  return { label, text, explanation, citation, verified: citation !== null };
}

export const MOCK_QUIZ: Question[] = [
  {
    id: "q1",
    orderIndex: 0,
    topic: "file_structure",
    prompt: "Which directory in the codebase contains the core business logic?",
    correctIndex: 1,
    options: [
      opt("A", "/tests", "Holds the test suite, not the logic under test.", { path: "tests/README.md", startLine: 1, endLine: 12 }),
      opt("B", "/src", "Every module imported by the entry point resolves under src/.", { path: "src/index.ts", startLine: 1, endLine: 24 }),
      opt("C", "/docs", "Markdown only — no code is imported from here.", { path: "docs/architecture.md", startLine: 3, endLine: 18 }),
      opt("D", "/scripts", "One-off maintenance scripts, not application code.", null),
    ],
  },
  {
    id: "q2",
    orderIndex: 1,
    topic: "core_logic",
    prompt: "What command starts the local development server?",
    correctIndex: 1,
    options: [
      opt("A", "npm run build", "Produces the production bundle; it does not serve.", { path: "package.json", startLine: 6, endLine: 11 }),
      opt("B", "npm run dev", "The dev script is the one that boots the local server.", { path: "package.json", startLine: 6, endLine: 11 }),
      opt("C", "npm test", "Runs the test runner in watch mode.", { path: "package.json", startLine: 6, endLine: 11 }),
      opt("D", "npm publish", "Publishes to the registry — not defined in this project.", null),
    ],
  },
  {
    id: "q3",
    orderIndex: 2,
    topic: "apis",
    prompt: "Where are shared React components defined?",
    correctIndex: 0,
    options: [
      opt("A", "/src/components", "Shared components live here and are imported across screens.", { path: "src/components/index.ts", startLine: 1, endLine: 20 }),
      opt("B", "/public", "Static assets served as-is; no modules.", { path: "public/README.md", startLine: 1, endLine: 4 }),
      opt("C", "/node_modules", "Third-party packages, never first-party source.", null),
      opt("D", "/dist", "Build output, excluded from ingestion.", null),
    ],
  },
  {
    id: "q4",
    orderIndex: 3,
    topic: "testing",
    prompt: "Which file configures the API base URL for each environment?",
    correctIndex: 1,
    options: [
      opt("A", "README.md", "Documents setup but sets nothing at runtime.", { path: "README.md", startLine: 30, endLine: 44 }),
      opt("B", ".env", "Environment variables are read from here at startup.", { path: ".env.example", startLine: 1, endLine: 9 }),
      opt("C", "index.html", "The document shell; it carries no configuration.", { path: "index.html", startLine: 1, endLine: 16 }),
      opt("D", "LICENSE", "Licensing text only.", null),
    ],
  },
  {
    id: "q5",
    orderIndex: 4,
    topic: "deployment",
    prompt: "How is the production bundle deployed?",
    correctIndex: 1,
    options: [
      opt("A", "Manually via FTP", "No FTP tooling exists in the repository.", null),
      opt("B", "CI pipeline on merge to main", "The workflow builds and deploys on push to main.", { path: ".github/workflows/deploy.yml", startLine: 1, endLine: 28 }),
      opt("C", "It is never deployed", "A deploy workflow is present and enabled.", { path: ".github/workflows/deploy.yml", startLine: 1, endLine: 28 }),
      opt("D", "Emailed as a zip", "Nothing in the repository packages a zip artifact.", null),
    ],
  },
];

/** Which option the player picked, per question — stands in for the answers table. */
export const MOCK_SELECTIONS: (number | null)[] = [1, 1, 2, 1, 1];

export type HistoryRow = {
  runId: string;
  repo: string;
  date: string;
  time: string;
  score: number;
  mastery: string;
  masteryTone: MasteryTone;
  best?: boolean;
};

export const MOCK_HISTORY: HistoryRow[] = [
  { runId: "demo-1", repo: "AcmeCorp/onboarding", date: "Sep 12, 2026", time: "10:24 PM", score: 4, mastery: "Well Knowledgeable", masteryTone: "green", best: true },
  { runId: "demo-2", repo: "personal-website", date: "Sep 10, 2026", time: "4:18 PM", score: 5, mastery: "Codebase Master", masteryTone: "grape" },
  { runId: "demo-3", repo: "WeebRaphael", date: "Sep 8, 2026", time: "9:02 PM", score: 3, mastery: "Getting There", masteryTone: "gold" },
  { runId: "demo-4", repo: "The-stroker", date: "Sep 5, 2026", time: "1:15 PM", score: 4, mastery: "Well Knowledgeable", masteryTone: "green" },
  { runId: "demo-5", repo: "Craziest-8", date: "Sep 2, 2026", time: "6:47 PM", score: 2, mastery: "Keep Practicing", masteryTone: "pink" },
  { runId: "demo-6", repo: "chess-engine", date: "Aug 30, 2026", time: "11:10 AM", score: 3, mastery: "Getting There", masteryTone: "gold" },
];

export const MOCK_SCORE_TREND = [30, 28, 42, 65, 52, 44, 70, 84, 92];
export const MOCK_TREND_LABELS = ["Aug 30", "Sep 2", "Sep 5", "Sep 8", "Sep 10", "Sep 12"];

export const MOCK_TOPIC_ACCURACY: { topic: Topic; pct: number; good: boolean }[] = [
  { topic: "file_structure", pct: 90, good: true },
  { topic: "core_logic", pct: 80, good: true },
  { topic: "apis", pct: 50, good: false },
  { topic: "testing", pct: 75, good: true },
  { topic: "deployment", pct: 85, good: true },
];

/** Stand-in for the derived HUD numbers until src/lib/progression queries run. */
export const MOCK_PLAYER = {
  username: "Player_Intern",
  correct: 21,
  quizzes: 6,
};
