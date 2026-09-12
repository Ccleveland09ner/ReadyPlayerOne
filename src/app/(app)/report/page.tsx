import type { ReactNode } from "react";
import {
  Arrow,
  Bulb,
  ChartIcon,
  ChevronDown,
  DocIcon,
  TargetIcon,
  Trophy,
} from "@/components/ui/Icons";
import { Panel, SubPanel } from "@/components/ui/Panel";
import { TrendChart } from "@/components/ui/TrendChart";
import { MASTERY_TONE_COLOR, percentFor } from "@/lib/progression/mastery";
import {
  MOCK_HISTORY,
  MOCK_SCORE_TREND,
  MOCK_TOPIC_ACCURACY,
  MOCK_TREND_LABELS,
} from "@/lib/mock-data";
import { TOPIC_LABELS } from "@/lib/types";

/**
 * Screen 11 — Reports dashboard (P1).
 *
 * TODO: every number here comes from one grouped query over answers joined to
 * this player runs, plus one ordered query for the trend. The insights are
 * template strings computed from those stats — never a model call.
 */
export default function ReportPage() {
  const quizzes = MOCK_HISTORY.length;
  const average = Math.round(
    MOCK_HISTORY.reduce((sum, r) => sum + percentFor(r.score, 5), 0) / Math.max(1, quizzes),
  );
  const best = Math.max(...MOCK_HISTORY.map((r) => percentFor(r.score, 5)));
  const strong = MOCK_TOPIC_ACCURACY.filter((t) => t.pct >= 75).length;

  return (
    <Panel className="max-w-5xl p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="text-4xl text-[#46c8ff]">
            <ChartIcon />
          </span>
          <div>
            <h1 className="text-pixel text-2xl text-white sm:text-3xl">REPORTS</h1>
            <p className="text-pixel mt-2 text-[9px] tracking-wide text-[#8fa0e6]">
              TRACK YOUR PROGRESS. FIND YOUR STRENGTHS. LEVEL UP.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="text-display flex items-center gap-3 rounded-lg px-4 py-2 text-base font-semibold text-white"
          style={{ border: "2px solid rgba(74,120,255,0.5)" }}
        >
          All Repositories <ChevronDown className="text-[#8fa0e6]" />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Trophy />} label="TOTAL QUIZZES" value={String(quizzes)} />
        <Stat icon={<TargetIcon />} label="AVERAGE SCORE" value={`${average}%`} />
        <Stat icon={<ChartIcon />} label="BEST SCORE" value={`${best}%`} valueColor="#4ade80" />
        <Stat
          icon={<DocIcon />}
          label="TOPIC ACCURACY"
          value={`${strong} / ${MOCK_TOPIC_ACCURACY.length}`}
          sub="STRONG AREAS"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SubPanel title="SCORE TREND">
          <TrendChart values={MOCK_SCORE_TREND} labels={MOCK_TREND_LABELS} />
        </SubPanel>
        <SubPanel title="PER-TOPIC PERFORMANCE">
          <div className="flex flex-col gap-3">
            {MOCK_TOPIC_ACCURACY.map((t) => (
              <div key={t.topic} className="flex items-center gap-3">
                <span className="text-display w-28 text-sm font-semibold text-[#cbc6f0]">
                  {TOPIC_LABELS[t.topic]}
                </span>
                <span className="h-3.5 flex-1 overflow-hidden rounded-full" style={{ background: "#241f52" }}>
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${t.pct}%`,
                      background: t.good
                        ? "linear-gradient(90deg,#22a05a,#4ade80)"
                        : "linear-gradient(90deg,#c0392b,#ff5470)",
                    }}
                  />
                </span>
                <span className="text-pixel w-10 text-right text-[10px] text-white">{t.pct}%</span>
              </div>
            ))}
          </div>
        </SubPanel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <SubPanel title="RECENT ACTIVITY">
          <div className="flex flex-col gap-2">
            {MOCK_HISTORY.slice(0, 5).map((r) => (
              <div key={r.runId} className="text-display grid grid-cols-[1fr_100px_90px_auto] items-center gap-2">
                <span className="truncate text-base font-semibold text-white">⑂ {r.repo}</span>
                <span className="text-sm text-[#8fa0e6]">{r.date}</span>
                <span className="text-sm font-semibold text-white">
                  {r.score} / 5 ({percentFor(r.score, 5)}%)
                </span>
                <span
                  className="justify-self-end rounded-md px-2 py-1 text-xs font-semibold"
                  style={{
                    border: `1.5px solid ${MASTERY_TONE_COLOR[r.masteryTone]}`,
                    color: MASTERY_TONE_COLOR[r.masteryTone],
                  }}
                >
                  {r.mastery}
                </span>
              </div>
            ))}
          </div>
        </SubPanel>
        <SubPanel title="INSIGHTS">
          <ul className="text-display flex flex-col gap-3 text-sm text-[#cbc6f0]">
            <li className="flex gap-3">
              <Arrow className="mt-0.5 text-[#4ade80]" />
              <span>
                Your scores have improved by <b className="text-white">40%</b> over time!
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#ffc23c]">
                <Bulb />
              </span>
              <span>
                You perform best in <b className="text-white">File Structure</b> and{" "}
                <b className="text-white">Deployment</b>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#ff5470]">
                <TargetIcon />
              </span>
              <span>
                Focus more on <b className="text-white">APIs</b> to improve your overall score.
              </span>
            </li>
          </ul>
        </SubPanel>
      </div>
    </Panel>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  valueColor,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ border: "2px solid rgba(74,120,255,0.35)", background: "rgba(24,20,64,0.6)" }}>
      <div className="flex items-center gap-2 text-[#8fa0e6]">
        <span className="text-xl">{icon}</span>
        <span className="text-pixel text-[8px] tracking-wide">{label}</span>
      </div>
      <div className="text-pixel mt-3 text-2xl" style={{ color: valueColor ?? "#fff" }}>
        {value}
      </div>
      {sub ? <div className="text-pixel mt-1 text-[7px] text-[#8b86c9]">{sub}</div> : null}
    </div>
  );
}
