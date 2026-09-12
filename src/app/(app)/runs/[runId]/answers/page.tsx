import Link from "next/link";
import { CitationLink, LowConfidenceTag } from "@/components/ui/CitationLink";
import { Check, Cross } from "@/components/ui/Icons";
import { Panel } from "@/components/ui/Panel";
import {
  MOCK_COMMIT_SHA,
  MOCK_QUIZ,
  MOCK_REPO,
  MOCK_SELECTIONS,
} from "@/lib/mock-data";
import { TOPIC_LABELS } from "@/lib/types";

/**
 * Screen 9 — Answer Review. There is no mockup for this screen; it reuses the
 * dark panel frame. This is where the verification pipeline becomes visible,
 * so every explanation carries its citation or is labelled low-confidence.
 */
export default async function AnswersPage({ params }: PageProps<"/runs/[runId]/answers">) {
  const { runId } = await params;
  const { owner, repo } = MOCK_REPO;

  return (
    <Panel className="max-w-4xl p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pixel text-2xl text-white sm:text-3xl">ANSWER REVIEW</h1>
          <p className="text-pixel mt-2 text-[9px] leading-relaxed tracking-wide text-[#8fa0e6]">
            EVERY CITATION IS PINNED TO THE COMMIT THAT WAS INGESTED.
          </p>
        </div>
        <Link href={`/runs/${runId}/complete`} className="btn-pixel btn-ghost !px-3 !py-2 !text-[9px]">
          BACK TO RESULTS
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {MOCK_QUIZ.map((question, qi) => {
          const selected = MOCK_SELECTIONS[qi];
          const isCorrect = selected === question.correctIndex;
          const chosen = selected === null ? null : question.options[selected];
          const answer = question.options[question.correctIndex];

          return (
            <article
              key={question.id}
              className="rounded-xl p-5"
              style={{
                border: `2px solid ${isCorrect ? "rgba(74,222,128,0.45)" : "rgba(255,84,112,0.45)"}`,
                background: "rgba(20,17,54,0.6)",
              }}
            >
              <header className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-pixel text-[9px] tracking-wide text-[#8fa0e6]">
                    Q{qi + 1} · {TOPIC_LABELS[question.topic].toUpperCase()}
                  </span>
                  <h2 className="text-display mt-2 text-xl font-semibold text-white">
                    {question.prompt}
                  </h2>
                </div>
                <span className={`text-2xl ${isCorrect ? "text-[#4ade80]" : "text-[#ff5470]"}`}>
                  {isCorrect ? <Check /> : <Cross />}
                </span>
              </header>

              <div className="mt-4 flex flex-col gap-3">
                {!isCorrect && chosen ? (
                  <Explanation
                    kind="wrong"
                    heading={`You chose ${chosen.label}. ${chosen.text}`}
                    body={chosen.explanation}
                    citation={chosen.verified ? chosen.citation : null}
                    owner={owner}
                    repo={repo}
                  />
                ) : null}

                <Explanation
                  kind="right"
                  heading={`Correct answer: ${answer.label}. ${answer.text}`}
                  body={answer.explanation}
                  citation={answer.verified ? answer.citation : null}
                  owner={owner}
                  repo={repo}
                />
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function Explanation({
  kind,
  heading,
  body,
  citation,
  owner,
  repo,
}: {
  kind: "right" | "wrong";
  heading: string;
  body: string;
  citation: { path: string; startLine: number; endLine: number } | null;
  owner: string;
  repo: string;
}) {
  const accent = kind === "right" ? "#4ade80" : "#ff5470";
  return (
    <div
      className="rounded-lg p-4"
      style={{ borderLeft: `4px solid ${accent}`, background: "rgba(12,10,34,0.5)" }}
    >
      <p className="text-display text-base font-semibold" style={{ color: accent }}>
        {heading}
      </p>
      <p className="text-display mt-2 text-sm text-[#cbc6f0]">{body}</p>
      <div className="mt-3">
        {citation ? (
          <CitationLink
            owner={owner}
            repo={repo}
            commitSha={MOCK_COMMIT_SHA}
            citation={citation}
          />
        ) : (
          <LowConfidenceTag />
        )}
      </div>
    </div>
  );
}
