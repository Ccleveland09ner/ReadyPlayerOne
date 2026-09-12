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
import { MASTERY_TONE_COLOR } from "@/lib/progression/mastery";
import { buildReport } from "@/lib/history";
import { TOPIC_LABELS } from "@/lib/types";

/**
 * Screen 11 — Reports dashboard (P1).
 *
 * Every number comes from one grouped read over this player's answers, plus
 * one ordered read for the trend. The insights are template strings computed
 * from those numbers — a model call here would cost latency and money to
 * produce text that can be wrong about data we already have exactly.
 */
export default async function ReportPage() {
  const report = await buildReport();

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

      {report.quizzes === 0 ? (
        <p className="text-display mt-8 text-center text-base text-[#b7b2e6]">
          Finish a quiz and this fills in — score trend, per-topic accuracy, and
          what to read next. It needs a few runs before the chart says anything.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<Trophy />} label="TOTAL QUIZZES" value={String(report.quizzes)} />
            <Stat icon={<TargetIcon />} label="AVERAGE SCORE" value={`${report.averagePercent}%`} />
            <Stat icon={<ChartIcon />} label="BEST SCORE" value={`${report.bestPercent}%`} valueColor="#4ade80" />
            <Stat
              icon={<DocIcon />}
              label="TOPIC ACCURACY"
              value={`${report.strongTopics} / ${report.topicCount}`}
              sub="STRONG AREAS"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SubPanel title="SCORE TREND">
              <TrendChart
                values={report.trend.map((point) => point.percent)}
                labels={report.trend.map((point) => point.label)}
              />
            </SubPanel>
            <SubPanel title="PER-TOPIC PERFORMANCE">
              <div className="flex flex-col gap-3">
                {report.topicAccuracy.map((t) => (
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
                {report.recent.map((r) => (
                  <div key={r.runId} className="text-display grid grid-cols-[1fr_100px_90px_auto] items-center gap-2">
                    <span className="truncate text-base font-semibold text-white">
                      ⑂ {r.owner}/{r.repo}
                    </span>
                    <span className="text-sm text-[#8fa0e6]">
                      {dateFormat.format(new Date(r.createdAt))}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {r.score} / {r.total} ({r.percent}%)
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
                {report.insights.map((insight, i) => (
                  <li key={insight} className="flex gap-3">
                    <span style={{ color: INSIGHT_COLORS[i % INSIGHT_COLORS.length] }}>
                      {INSIGHT_ICONS[i % INSIGHT_ICONS.length]}
                    </span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </SubPanel>
          </div>
        </>
      )}
    </Panel>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const INSIGHT_ICONS = [<Arrow key="a" />, <Bulb key="b" />, <TargetIcon key="c" />];
const INSIGHT_COLORS = ["#4ade80", "#ffc23c", "#ff5470"];

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
