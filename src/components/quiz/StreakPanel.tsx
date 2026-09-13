import type { CSSProperties } from "react";
import { Flame } from "@/components/ui/Icons";
import { levelName } from "@/lib/progression/mastery";

/** Shared by both rail panels so the two read as one stack. */
const RAIL_PANEL = {
  "--box-bg": "rgba(16,13,44,0.95)",
  "--box-edge": "rgba(74,120,255,0.55)",
} as CSSProperties;

/**
 * The quiz-only right rail: Your Progress, Current Streak, and the poster.
 * The streak comes from the current run's answers in order — it increments on
 * a correct answer and resets to zero on a wrong one.
 */
export function QuizRail({
  level,
  answered,
  total,
  streak,
}: {
  level: number;
  answered: number;
  total: number;
  streak: number;
}) {
  return (
    <div className="flex w-full flex-col gap-3 lg:w-56">
      <div className="box-8bit p-4" style={RAIL_PANEL}>
        <h3 className="text-pixel text-[9px] tracking-wide text-[#8fa0e6]">YOUR PROGRESS</h3>
        <p className="text-pixel mt-2 text-[10px] leading-relaxed text-white">
          Level {level}: {levelName(level)}
        </p>
        <p className="text-pixel mt-2 text-sm text-[#cfc8ff]">
          {answered} / {total}
        </p>
      </div>

      <div className="box-8bit p-4" style={RAIL_PANEL}>
        <h3 className="text-pixel text-[9px] tracking-wide text-[#8fa0e6]">CURRENT STREAK</h3>
        <p className="mt-2 flex items-center gap-2">
          <span className="text-2xl">
            <Flame />
          </span>
          <span className="text-pixel text-xl text-white">{streak}</span>
        </p>
      </div>

      <div
        className="box-8bit p-4 text-center"
        style={
          {
            "--box-edge": "rgba(255,63,164,0.4)",
            "--box-bg": "rgba(40,20,64,0.6)",
          } as CSSProperties
        }
      >
        <p className="text-pixel text-[9px] leading-relaxed text-[#ffb3d9]">
          SCHOOL GRADES THE CODE YOU WROTE. WORK GRADES THE CODE YOU READ.
        </p>
      </div>
    </div>
  );
}
