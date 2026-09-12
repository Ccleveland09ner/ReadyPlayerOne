import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Cross, Trophy } from "@/components/ui/Icons";
import { MasteryBar } from "@/components/ui/MasteryBar";
import { Panel, SubPanel } from "@/components/ui/Panel";
import { percentFor } from "@/lib/progression/mastery";
import { TOPIC_LABELS, TOPIC_ORDER } from "@/lib/types";
import { loadResults } from "@/lib/quiz/read";

/** Screen 8 — Quiz Complete. */
export default async function CompletePage({ params }: PageProps<"/runs/[runId]/complete">) {
  const { runId } = await params;

  const results = await loadResults(runId);
  if (!results) notFound();

  const { score, total, breakdown, topicsPassed } = results;
  const percent = percentFor(score, total);

  return (
    <Panel className="max-w-4xl p-6 sm:p-8">
      <div className="text-center">
        <h1
          className="text-pixel text-3xl sm:text-4xl"
          style={{
            background: "linear-gradient(180deg,#ffd25a,#ff8a3c 60%,#ff4fa3)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 3px 0 rgba(0,0,0,0.4)",
          }}
        >
          QUIZ COMPLETE!
        </h1>
        <p className="text-pixel mt-3 text-sm tracking-wide text-[#8fa0e6]">
          HERE&rsquo;S HOW YOU DID
        </p>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <SubPanel title="SCORE">
          <div className="flex items-center gap-4">
            <span className="text-5xl">
              <Trophy />
            </span>
            <div>
              <div className="text-pixel text-4xl text-white">
                {score}
                <span className="text-[#8fa0e6]"> / {total}</span>
              </div>
              <div className="text-pixel mt-1 text-xl text-[#7c8cff]">{percent}%</div>
            </div>
          </div>
        </SubPanel>

        <SubPanel title="CODEBASE MASTERY">
          <MasteryBar score={score} total={total} />
        </SubPanel>

        <SubPanel title="QUESTION BREAKDOWN">
          <div className="flex flex-wrap gap-3">
            {breakdown.map((ok, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1 rounded-lg px-3 py-2"
                style={{ border: "2px solid #2f2a63" }}
              >
                <span className={`text-2xl ${ok ? "text-[#4ade80]" : "text-[#ff5470]"}`}>
                  {ok ? <Check /> : <Cross />}
                </span>
                <span className="text-pixel text-[9px] text-[#9a94d6]">Q{i + 1}</span>
              </div>
            ))}
          </div>
        </SubPanel>

        <SubPanel title="TOPICS COVERED">
          <ul className="text-display grid gap-1.5 text-base text-[#cbc6f0]">
            {TOPIC_ORDER.map((topic) => (
              <li key={topic} className="flex items-center justify-between">
                <span>{TOPIC_LABELS[topic]}</span>
                <span className={topicsPassed[topic] ? "text-[#4ade80]" : "text-[#ff5470]"}>
                  {topicsPassed[topic] ? <Check /> : <Cross />}
                </span>
              </li>
            ))}
          </ul>
        </SubPanel>
      </div>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href={`/runs/${runId}/answers`} className="btn-pixel btn-grape">
          VIEW ANSWERS
        </Link>
        {/* TODO: Try Again creates a new run against the cached snapshot. */}
        <Link href={`/runs/${runId}/start`} className="btn-pixel btn-ghost">
          TRY AGAIN
        </Link>
        <Link href="/" className="btn-pixel btn-gold">
          BACK HOME
        </Link>
      </div>
    </Panel>
  );
}
