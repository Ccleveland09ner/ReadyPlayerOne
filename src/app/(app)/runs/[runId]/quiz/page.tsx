import { notFound, redirect } from "next/navigation";
import { loadQuizForPlay } from "@/lib/quiz/read";
import { QuizPlayer } from "./quiz-player";

/** Screen 7 — quiz play. */
export default async function QuizPage({ params }: PageProps<"/runs/[runId]/quiz">) {
  const { runId } = await params;
  const quiz = await loadQuizForPlay(runId);
  if (!quiz) notFound();

  // Not generated yet: send them back to the progress screen rather than
  // rendering an empty quiz.
  if (quiz.questions.length === 0) redirect(`/runs/${runId}`);
  if (quiz.run.completed_at) redirect(`/runs/${runId}/complete`);

  return (
    <QuizPlayer
      runId={runId}
      questions={quiz.questions}
      startIndex={quiz.resumeAt}
      heartsRemaining={quiz.run.hearts_remaining}
      initialStreak={quiz.streak}
    />
  );
}
