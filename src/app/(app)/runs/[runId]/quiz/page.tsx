import { MOCK_QUIZ } from "@/lib/mock-data";
import { QuizPlayer } from "./quiz-player";

/** Screen 7 — quiz play. */
export default async function QuizPage({ params }: PageProps<"/runs/[runId]/quiz">) {
  const { runId } = await params;

  // TODO: load this run's questions, and its answers so a refresh resumes at
  // the first unanswered question rather than restarting.
  return <QuizPlayer runId={runId} questions={MOCK_QUIZ} />;
}
