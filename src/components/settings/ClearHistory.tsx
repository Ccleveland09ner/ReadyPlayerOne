"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { useFormStatus } from "react-dom";
import { clearHistoryAction, type ClearHistoryState } from "@/lib/history/actions";
import { CLEAR_CONFIRMATION } from "@/lib/history/confirm";

const DANGER = {
  background: "transparent",
  color: "#ff5470",
  "--btn-edge": "#ff5470",
} as CSSProperties;

/**
 * Clear Quiz History.
 *
 * Deliberately two steps with a typed confirmation. This deletes every quiz
 * the player has taken and cannot be undone, and it sits one row above Export
 * My Data in a panel people poke at out of curiosity -- a single click that
 * silently wipes an account is not a feature.
 *
 * `quizzes` is what the player is about to lose, shown before they commit
 * rather than reported afterwards.
 */
export function ClearHistory({ quizzes }: { quizzes: number }) {
  const [armed, setArmed] = useState(false);
  const [state, formAction] = useActionState<ClearHistoryState, FormData>(
    clearHistoryAction,
    {},
  );

  if (state.cleared) {
    const { deleted, preserved } = state.cleared;
    return (
      <p role="status" className="text-pixel text-[9px] leading-relaxed text-[#4ade80]">
        Cleared {deleted} {deleted === 1 ? "quiz" : "quizzes"}.
        {preserved > 0 ? (
          <span className="block text-[#b7b2e6]">
            {preserved} indexed {preserved === 1 ? "repository is" : "repositories are"}{" "}
            kept as a shared cache with your score and answers removed — other
            players&rsquo; quizzes were built on them.
          </span>
        ) : null}
      </p>
    );
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        disabled={quizzes === 0}
        className="btn-pixel btn-8bit !py-2 !text-[9px] disabled:cursor-not-allowed disabled:opacity-50"
        style={DANGER}
      >
        {quizzes === 0 ? "NOTHING TO CLEAR" : "CLEAR HISTORY"}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <p className="text-pixel text-[9px] leading-relaxed text-[#ff5470]">
        This permanently deletes {quizzes} {quizzes === 1 ? "quiz" : "quizzes"},
        every answer, and the report built from them. It cannot be undone.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="confirm"
          autoFocus
          autoComplete="off"
          aria-label={`Type ${CLEAR_CONFIRMATION} to confirm`}
          placeholder={`Type ${CLEAR_CONFIRMATION}`}
          className="box-8bit text-pixel px-3 py-2 text-[10px] tracking-wide text-white outline-none"
          style={
            {
              "--box-bg": "rgba(9,7,26,0.6)",
              "--box-edge": "#ff5470",
              minWidth: 150,
            } as CSSProperties
          }
        />
        <ConfirmButton />
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="btn-pixel btn-8bit btn-ghost !py-2 !text-[9px]"
        >
          CANCEL
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-pixel text-[9px] leading-relaxed text-[#ff5470]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-pixel btn-8bit !py-2 !text-[9px] disabled:cursor-not-allowed disabled:opacity-60"
      style={DANGER}
    >
      {pending ? "DELETING…" : "DELETE EVERYTHING"}
    </button>
  );
}
