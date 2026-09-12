import Link from "next/link";
import type { CSSProperties } from "react";
import { Arrow, BranchIcon, DocIcon, Trophy } from "@/components/ui/Icons";
import { Pager } from "@/components/ui/Pager";
import { Panel } from "@/components/ui/Panel";
import { MASTERY_TONE_COLOR } from "@/lib/progression/mastery";
import { HISTORY_PAGE_SIZE, listRuns } from "@/lib/history";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const scoreColor = (n: number) => (n >= 4 ? "#4ade80" : n >= 3 ? "#ffc23c" : "#ff5470");

/** Screen 10 — Quiz History, newest first, 10 rows per page. */
export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  // Scoped by the anon_id cookie server-side; the client never supplies one.
  const { rows, total, pageCount } = await listRuns(page);

  return (
    <Panel className="max-w-5xl p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="text-4xl text-[#7c8cff]">
            <DocIcon />
          </span>
          <div>
            <h1 className="text-pixel text-2xl text-white sm:text-3xl">QUIZ HISTORY</h1>
            <p className="text-pixel mt-2 text-[9px] leading-relaxed tracking-wide text-[#8fa0e6]">
              A RECORD OF YOUR JOURNEY. SMALL STEPS. BIG PROGRESS.
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-pixel text-[9px] text-[#8fa0e6]">TOTAL QUIZZES</div>
          <div
            className="chip-8bit text-pixel mt-2 inline-block px-4 py-2 text-xl text-white"
            style={{ "--chip-edge": "rgba(74,120,255,0.5)" } as CSSProperties}
          >
            {total}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-pixel mt-8 text-center text-[10px] leading-relaxed tracking-wide text-[#b7b2e6]">
          No runs yet. Quizzes you take show up here — score, mastery and a link
          straight back into the answers. Sign in to keep them across browsers.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[640px]">
            <div
              className="text-pixel grid grid-cols-[40px_1fr_140px_120px_1fr_120px] gap-3 px-2 pb-3 text-[9px] tracking-wide text-[#8fa0e6]"
              style={{ borderBottom: "2px solid #2a2358" }}
            >
              <span>#</span>
              <span>REPOSITORY</span>
              <span>DATE</span>
              <span>SCORE</span>
              <span>MASTERY</span>
              <span />
            </div>

            {rows.map((row, i) => (
              <div
                key={row.runId}
                className="box-8bit grid grid-cols-[40px_1fr_140px_120px_1fr_120px] items-center gap-3 px-2 py-3 transition hover:brightness-110"
                style={
                  {
                    marginTop: 8,
                    "--box-bg": "rgba(24,20,64,0.55)",
                    "--box-edge": row.best ? "var(--color-gold)" : "#241f52",
                  } as CSSProperties
                }
              >
                <span className="text-pixel text-sm text-white">
                  {row.best ? <Trophy /> : (page - 1) * HISTORY_PAGE_SIZE + i + 1}
                </span>
                <span className="text-pixel flex items-center gap-2 text-[11px] tracking-wide text-white">
                  <BranchIcon className="text-[#7c8cff]" /> {row.owner}/{row.repo}
                </span>
                <span className="text-pixel text-[10px] leading-relaxed tracking-wide text-[#b7b2e6]">
                  {dateFormat.format(new Date(row.createdAt))}
                  <br />
                  <span className="text-[#8b86c9]">
                    {timeFormat.format(new Date(row.createdAt))}
                  </span>
                </span>
                <span className="text-pixel text-xs" style={{ color: scoreColor(row.score) }}>
                  {row.score} / {row.total}
                  <br />
                  <span className="text-[10px]">{row.percent}%</span>
                </span>
                <span
                  className="text-pixel text-[11px] tracking-wide"
                  style={{ color: MASTERY_TONE_COLOR[row.masteryTone] }}
                >
                  {row.mastery}
                </span>
                {/* Finished runs open results; unfinished ones resume. */}
                <Link
                  href={row.href}
                  className="btn-pixel btn-8bit btn-gold justify-self-end !px-3 !py-2 !text-[9px]"
                >
                  VIEW <Arrow className="text-xs" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {pageCount > 1 ? <Pager page={page} pageCount={pageCount} basePath="/history" /> : null}
    </Panel>
  );
}
