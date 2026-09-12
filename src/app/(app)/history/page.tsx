import Link from "next/link";
import { Arrow, BranchIcon, DocIcon, Trophy } from "@/components/ui/Icons";
import { Pager } from "@/components/ui/Pager";
import { Panel } from "@/components/ui/Panel";
import { MASTERY_TONE_COLOR, percentFor } from "@/lib/progression/mastery";
import { MOCK_HISTORY } from "@/lib/mock-data";

const PAGE_SIZE = 10;

const scoreColor = (n: number) => (n >= 4 ? "#4ade80" : n >= 3 ? "#ffc23c" : "#ff5470");

/** Screen 10 — Quiz History, newest first, 10 rows per page. */
export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  // TODO: read runs for this player from src/lib/history, scoped by the
  // anon_id cookie server-side (the client must never supply an anon_id).
  const total = MOCK_HISTORY.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = MOCK_HISTORY.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
            className="text-pixel mt-2 inline-block rounded-lg px-4 py-2 text-xl text-white"
            style={{ border: "2px solid rgba(74,120,255,0.5)" }}
          >
            {total}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-display mt-8 text-center text-base text-[#b7b2e6]">
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
                className="grid grid-cols-[40px_1fr_140px_120px_1fr_120px] items-center gap-3 rounded-lg px-2 py-3 transition hover:brightness-110"
                style={{
                  marginTop: 8,
                  border: row.best ? "2px solid var(--color-gold)" : "2px solid #241f52",
                  background: "rgba(24,20,64,0.55)",
                }}
              >
                <span className="text-pixel text-sm text-white">
                  {row.best ? <Trophy /> : (page - 1) * PAGE_SIZE + i + 1}
                </span>
                <span className="text-display flex items-center gap-2 text-lg font-semibold text-white">
                  <BranchIcon className="text-[#7c8cff]" /> {row.repo}
                </span>
                <span className="text-display text-sm text-[#b7b2e6]">
                  {row.date}
                  <br />
                  <span className="text-[#8b86c9]">{row.time}</span>
                </span>
                <span className="text-pixel text-xs" style={{ color: scoreColor(row.score) }}>
                  {row.score} / 5
                  <br />
                  <span className="text-[10px]">{percentFor(row.score, 5)}%</span>
                </span>
                <span
                  className="text-display text-base font-semibold"
                  style={{ color: MASTERY_TONE_COLOR[row.masteryTone] }}
                >
                  {row.mastery}
                </span>
                {/* TODO: a finished run opens complete; an unfinished one resumes
                    at the first unanswered question. */}
                <Link
                  href={`/runs/${row.runId}/complete`}
                  className="btn-pixel btn-gold justify-self-end !px-3 !py-2 !text-[9px]"
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
