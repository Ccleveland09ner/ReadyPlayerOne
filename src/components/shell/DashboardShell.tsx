import type { ReactNode } from "react";
import { SideNav } from "@/components/shell/SideNav";
import { TopBar } from "@/components/shell/TopBar";
import { DEMO_RUN_ID, MOCK_PLAYER, MOCK_REPO } from "@/lib/mock-data";

/**
 * The game shell present on every screen except splash and auth: left rail,
 * top bar, and the content panel floating over the room scene.
 *
 * TODO: the right rail (Your Progress / Current Streak / poster) is quiz-only
 * in the PRD and is not in the reconstruction yet — add it as a slot here.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="room-scene min-h-screen w-full">
      <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col lg:flex-row">
        <SideNav quizHref={`/runs/${DEMO_RUN_ID}/start`} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            owner={MOCK_REPO.owner}
            repo={MOCK_REPO.repo}
            username={MOCK_PLAYER.username}
            correct={MOCK_PLAYER.correct}
            quizzes={MOCK_PLAYER.quizzes}
          />
          <main className="flex flex-1 items-start justify-center px-3 pb-8 lg:px-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
