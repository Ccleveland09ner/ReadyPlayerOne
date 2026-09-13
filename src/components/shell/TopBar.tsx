import { PlayerSprite } from "@/components/ui/Brand";
import { RepoSelector, type RecentRepo } from "@/components/shell/RepoSelector";
import { progressionFor } from "@/lib/progression/mastery";

/**
 * Repository selector on the left, player card on the right.
 *
 * The player numbers are derived, never stored — they come straight from this
 * player's answer rows, so deleting a run corrects them for free.
 */
export function TopBar({
  owner,
  repo,
  username,
  correct,
  quizzes,
  recent,
}: {
  owner: string | null;
  repo: string | null;
  username: string;
  correct: number;
  quizzes: number;
  recent: RecentRepo[];
}) {
  const { level, xpIntoLevel, xpForLevel } = progressionFor({ correct, quizzes });
  const pct = Math.round((xpIntoLevel / xpForLevel) * 100);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-3 py-4 lg:px-6">
      <RepoSelector owner={owner} repo={repo} recent={recent} />

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
