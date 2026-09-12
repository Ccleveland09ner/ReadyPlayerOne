"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Hearts } from "@/components/quiz/Hearts";
import { ProgressPips } from "@/components/quiz/ProgressPips";
import { QuizRail } from "@/components/quiz/StreakPanel";
import { Arrow, Bulb } from "@/components/ui/Icons";
import { Panel } from "@/components/ui/Panel";
import { levelName } from "@/lib/progression/mastery";
import { TOPIC_LABELS, type Question } from "@/lib/types";

const STARTING_HEARTS = 3;

/**
 * Screen 7 — one question per screen.
 *
 * TODO: POST each selection to /api/runs/:id/answers so a refresh resumes at
 * the right question with hearts and streak intact; the route returns
 * isCorrect, correctIndex, heartsRemaining and streak. Scoring is a local
 * comparison there, not a model call — this component keeps its own copy only
 * until that route exists.
 */
export function QuizPlayer({ runId, questions }: { runId: string; questions: Question[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hearts, setHearts] = useState(STARTING_HEARTS);
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState<boolean[]>([]);

  const question = questions[index];
  const total = questions.length;
  const level = 1;

  function submit() {
    if (picked === null || revealed) return;
    const isCorrect = picked === question.correctIndex;
    setRevealed(true);
    setCorrect((c) => [...c, isCorrect]);
    setStreak((s) => (isCorrect ? s + 1 : 0));
    if (!isCorrect) setHearts((h) => h - 1);
  }

  function next() {
    // At zero hearts the run ends early and reports on what was answered.
    const outOfHearts = hearts <= 0;
    if (outOfHearts || index + 1 >= total) {
      router.push(`/runs/${runId}/complete`);
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setRevealed(false);
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 lg:flex-row">
      <Panel tone="light" className="max-w-4xl p-6 sm:p-9">
        <div className="flex items-start justify-between">
          <Hearts remaining={hearts} total={STARTING_HEARTS} />
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
        <h2 className="text-display text-ink mt-2 text-3xl leading-tight font-bold sm:text-4xl">
          {question.prompt}
        </h2>

        <div className="mt-6 flex flex-col gap-3">
          {question.options.map((option, i) => {
            const on = picked === i;
            const isAnswer = i === question.correctIndex;
            const showCorrect = revealed && isAnswer;
            const showWrong = revealed && on && !isAnswer;

            const background = showCorrect
              ? "#c7f0d0"
              : showWrong
                ? "#ffd6dd"
                : on
                  ? "#c7f0d0"
                  : "#eceef8";
            const border = showCorrect
              ? "2px solid var(--color-lime-deep)"
              : showWrong
                ? "2px solid #c0392b"
                : on
                  ? "2px solid var(--color-lime-deep)"
                  : "2px solid #d3d6ec";

            return (
              <button
                key={option.label}
                type="button"
                onClick={() => setPicked(i)}
                disabled={revealed}
                aria-pressed={on}
                className="group flex items-center gap-4 rounded-xl px-3 py-3 text-left transition disabled:cursor-default"
                style={{
                  background,
                  border,
                  boxShadow: on && !revealed ? "0 0 0 3px rgba(74,222,128,0.25)" : "none",
                }}
              >
                <span
                  className="text-display flex h-11 w-11 items-center justify-center rounded-md text-xl font-bold"
                  style={{
                    background: showCorrect
                      ? "var(--color-lime-deep)"
                      : showWrong
                        ? "#c0392b"
                        : on
                          ? "var(--color-lime-deep)"
                          : "#daddf0",
                    color: showCorrect || showWrong || on ? "#fff" : "#5a5588",
                  }}
                >
                  {option.label}
                </span>
                <span className="text-display text-ink text-xl font-semibold">{option.text}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          {/* TODO (P2): reveal the grounding file path without the answer. */}
          <button
            type="button"
            className="text-display flex items-center gap-2 text-lg font-semibold text-[#6d4aff] transition hover:text-[#4a2fc0]"
          >
            <Bulb /> Need a hint?
          </button>
          <button
            type="button"
            onClick={revealed ? next : submit}
            disabled={picked === null}
            className="btn-pixel btn-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!revealed ? "SUBMIT" : index + 1 >= total || hearts <= 0 ? "FINISH" : "NEXT QUESTION"}
            <Arrow className="text-sm" />
          </button>
        </div>
      </Panel>

      <QuizRail level={level} answered={correct.length} total={total} streak={streak} />
    </div>
  );
}
