import type { ReactNode } from "react";
import { SideNav } from "@/components/shell/SideNav";
import { TopBar } from "@/components/shell/TopBar";
import { BackgroundPixelStars } from "@/components/ui/background-pixel-stars";
import { currentIdentity, playerTotals } from "@/lib/history";
import { currentProfile } from "@/lib/auth/session";
import { recentRepos } from "@/lib/quiz/read";

/**
 * The game shell present on every screen except the landing page: left rail,
 * top bar, and the content panel floating over the pixel starfield.
 *
 * TODO: the right rail (Your Progress / Current Streak / poster) is quiz-only
 * in the PRD and is not in the reconstruction yet — add it as a slot here.
 *
 * The HUD numbers are derived, never stored: one query over this player's
 * answers, so deleting a run corrects every total for free.
 */
export async function DashboardShell({ children }: { children: ReactNode }) {
  const { anonId, userId } = await currentIdentity();
  const [totals, repos, profile] = await Promise.all([
    playerTotals(),
    recentRepos(anonId, userId),
    currentProfile(),
  ]);
  const current = repos[0] ?? null;
  return (
    // The same pixel starfield as the landing and auth screens, on the same
    // flat base. z-10 on the content is required, not cosmetic: the canvas is
    // positioned, so at equal z-index it would paint over the unpositioned
    // shell content rather than behind it.
    <div className="min-h-screen w-full bg-[#100c26]">
      <BackgroundPixelStars />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1280px] flex-col lg:flex-row">
        <SideNav quizHref={current ? `/runs/${current.runId}/start` : "/home"} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            owner={current?.owner ?? null}
            repo={current?.repo ?? null}
            username={profile.displayName}
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
