import { PlayerSprite } from "@/components/ui/Brand";
import { BranchIcon, ChevronDown } from "@/components/ui/Icons";
import { progressionFor } from "@/lib/progression/mastery";

/**
 * Repository selector on the left, player card on the right.
 *
 * TODO: the selector is a static button until the repo dropdown lands — it
 * should list previously used repos and read "Select a repository…" when the
 * player has none. The player numbers are derived (never stored); they come
 * from src/lib/progression once the answers table exists.
 */
export function TopBar({
  owner,
  repo,
  username,
  correct,
  quizzes,
}: {
  owner: string | null;
  repo: string | null;
  username: string;
  correct: number;
  quizzes: number;
}) {
  const { level, xpIntoLevel, xpForLevel } = progressionFor({ correct, quizzes });
  const pct = Math.round((xpIntoLevel / xpForLevel) * 100);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-3 py-4 lg:px-6">
      <button
        type="button"
        className="pixel-panel-light flex min-w-[220px] items-center gap-3 px-4 py-3 text-left transition hover:brightness-105 sm:min-w-[340px]"
      >
        <BranchIcon className="text-xl text-[#5b3fd6]" />
        <span className="text-pixel text-ink flex-1 text-[11px] tracking-wide">
          {repo ? (
            <>
              <span style={{ color: "#7b76ad" }}>{owner}</span> / {repo}
            </>
          ) : (
            <span style={{ color: "#7b76ad" }}>Select a repository…</span>
          )}
        </span>
        <ChevronDown className="text-lg text-[#6f68a8]" />
      </button>

      <div className="flex items-center gap-3">
        <PlayerSprite size={44} />
        <div className="leading-tight">
          <div className="text-pixel text-sm tracking-wide text-white">{username}</div>
          <div className="flex items-center gap-2">
            <span className="text-pixel text-[9px]" style={{ color: "var(--color-lilac)" }}>
              Lv. {level}
            </span>
            <span className="meter-8bit hidden h-2 w-28 overflow-hidden bg-[#2a2358] sm:block">
              <span
                className="block h-full"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg,#7c5cff,#46c8ff)",
                }}
              />
            </span>
            <span className="text-pixel hidden text-[8px] text-[#8b86c9] sm:inline">
              {xpIntoLevel}/{xpForLevel} XP
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
