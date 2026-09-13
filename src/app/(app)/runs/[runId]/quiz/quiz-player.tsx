"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { Hearts } from "@/components/quiz/Hearts";
import { ProgressPips } from "@/components/quiz/ProgressPips";
import { QuizRail } from "@/components/quiz/StreakPanel";
import { Arrow, Bulb } from "@/components/ui/Icons";
import { Panel } from "@/components/ui/Panel";
import { levelName } from "@/lib/progression/mastery";
import { TOPIC_LABELS } from "@/lib/types";
import type { PlayableQuestion } from "@/lib/quiz/read";

/**
 * Screen 7 — one question per screen.
 *
 * Scoring happens server-side: this component does not receive the answer key.
 * POST /api/runs/:id/answers compares the selection against the stored correct
 * index and returns the verdict, the explanations, hearts and streak. It is
 * idempotent per question, so a double-tap cannot drain hearts.
 */

type AnswerResponse = {
  isCorrect: boolean;
  correctIndex: number;
  heartsRemaining: number;
  streak: number;
  runComplete: boolean;
  outOfHearts: boolean;
};

export function QuizPlayer({
  runId,
  questions,
  startIndex,
  heartsRemaining,
  initialStreak,
}: {
  runId: string;
  questions: PlayableQuestion[];
  startIndex: number;
  heartsRemaining: number;
  initialStreak: number;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(startIndex);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hearts, setHearts] = useState(heartsRemaining);
  const [streak, setStreak] = useState(initialStreak);
  const [answered, setAnswered] = useState(startIndex);

  const question = questions[index];
  const total = questions.length;
  const level = 1;

  async function submit() {
    if (picked === null || result || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/runs/${runId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedIndex: picked }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not record that answer.");
        setSubmitting(false);
        return;
      }

      setResult(payload as AnswerResponse);
      setHearts(payload.heartsRemaining);
      setStreak(payload.streak);
      setAnswered((count) => count + 1);
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    // At zero hearts the run ends early and reports on what was answered.
    if (result?.runComplete || index + 1 >= total) {
      router.push(`/runs/${runId}/complete`);
      router.refresh();
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setResult(null);
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 lg:flex-row">
      <Panel tone="light" className="max-w-4xl p-6 sm:p-9">
        <div className="flex items-start justify-between">
          <Hearts remaining={hearts} total={3} />
          <div className="text-pixel text-xs text-[#5a5588]">
            QUESTION {index + 1} / {total}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="text-pixel text-xs tracking-wide text-[#7c5cff]">
            LEVEL {level}: {levelName(level).toUpperCase()}
          </div>
          <ProgressPips current={index} total={total} />
        </div>

        <p className="text-pixel mt-5 text-[10px] tracking-wide text-[#7b76ad]">
          {TOPIC_LABELS[question.topic].toUpperCase()}
        </p>
        <h2 className="text-pixel text-ink mt-3 text-base leading-[1.7] sm:text-lg sm:leading-[1.7]">
          {question.prompt}
        </h2>

        <div className="mt-6 flex flex-col gap-3">
          {question.options.map((option, i) => {
            const on = picked === i;
            const showCorrect = result !== null && i === result.correctIndex;
            const showWrong = result !== null && on && !result.isCorrect;

            const background = showCorrect
              ? "#c7f0d0"
              : showWrong
                ? "#ffd6dd"
                : on
                  ? "#c7f0d0"
                  : "#eceef8";
            const edge = showCorrect
              ? "var(--color-lime-deep)"
              : showWrong
                ? "#c0392b"
                : on
                  ? "var(--color-lime-deep)"
                  : "#c2c6e2";
            const badge = showCorrect
              ? "var(--color-lime-deep)"
              : showWrong
                ? "#c0392b"
                : on
                  ? "var(--color-lime-deep)"
                  : "#daddf0";

            return (
              <button
                key={option.label}
                type="button"
                onClick={() => setPicked(i)}
                disabled={result !== null || submitting}
                aria-pressed={on}
                className="box-8bit group flex items-center gap-4 px-3 py-3 text-left transition disabled:cursor-default"
                style={
                  {
                    "--box-bg": background,
                    "--box-edge": edge,
                    // A light panel needs its highlight and shade inverted:
                    // white-on-parchment reads as glare, not as a bevel.
                    "--box-hi": "rgba(255,255,255,0.85)",
                    "--box-lo": "rgba(0,0,0,0.12)",
                  } as CSSProperties
                }
              >
                <span
                  className="chip-8bit text-pixel flex h-11 w-11 items-center justify-center text-base"
                  style={
                    {
                      "--chip-bg": badge,
                      "--chip-edge": badge,
                      color: showCorrect || showWrong || on ? "#fff" : "#5a5588",
                    } as CSSProperties
                  }
                >
                  {option.label}
                </span>
                <span className="text-pixel text-ink text-[11px] leading-[1.9] sm:text-xs sm:leading-[1.9]">
                  {option.text}
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="text-pixel mt-4 text-[10px] leading-relaxed text-[#c0392b]">{error}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-4">
          {/* TODO (P2): reveal the grounding file path without the answer. */}
          <button
            type="button"
            className="text-pixel flex items-center gap-2 text-[10px] text-[#6d4aff] transition hover:text-[#4a2fc0]"
          >
            <Bulb /> Need a hint?
          </button>
          <button
            type="button"
            onClick={result ? next : submit}
            disabled={picked === null || submitting}
            className="btn-pixel btn-8bit btn-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "CHECKING…"
              : !result
                ? "SUBMIT"
                : result.runComplete || index + 1 >= total
                  ? "FINISH"
                  : "NEXT QUESTION"}
            <Arrow className="text-sm" />
          </button>
        </div>
      </Panel>

      <QuizRail level={level} answered={answered} total={total} streak={streak} />
    </div>
  );
}
