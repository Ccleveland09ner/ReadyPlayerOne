import type { ReactNode } from "react";
import { SideNav } from "@/components/shell/SideNav";
import { TopBar } from "@/components/shell/TopBar";
import { currentIdentity, playerTotals } from "@/lib/history";
import { recentRepos } from "@/lib/quiz/read";

/**
 * The game shell present on every screen except splash and auth: left rail,
 * top bar, and the content panel floating over the room scene.
 *
 * TODO: the right rail (Your Progress / Current Streak / poster) is quiz-only
 * in the PRD and is not in the reconstruction yet — add it as a slot here.
 *
 * The HUD numbers are derived, never stored: one query over this player's
 * answers, so deleting a run corrects every total for free.
 */
export async function DashboardShell({ children }: { children: ReactNode }) {
  const { anonId, userId } = await currentIdentity();
  const [totals, repos] = await Promise.all([
    playerTotals(),
    recentRepos(anonId, userId),
  ]);
  const current = repos[0] ?? null;
  return (
    <div className="room-scene min-h-screen w-full">
      <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col lg:flex-row">
        <SideNav quizHref={current ? `/runs/${current.runId}/start` : "/"} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            owner={current?.owner ?? null}
            repo={current?.repo ?? null}
            username="Player_Intern"
            correct={totals.correct}
            quizzes={totals.quizzes}
          />
          <main className="flex flex-1 items-start justify-center px-3 pb-8 lg:px-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
