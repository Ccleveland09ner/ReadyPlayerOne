import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CitationLink, LowConfidenceTag } from "@/components/ui/CitationLink";
import { Check, Cross } from "@/components/ui/Icons";
import { Panel } from "@/components/ui/Panel";
import { loadReview } from "@/lib/quiz/read";
import { TOPIC_LABELS, type Citation } from "@/lib/types";

/**
 * Screen 9 — Answer Review.
 *
 * Where the verification pipeline becomes visible. Every citation here
 * survived all four rules at generation time; an option whose citation was
 * stripped is labelled low-confidence rather than presented as authoritative.
 */
export default async function AnswersPage({ params }: PageProps<"/runs/[runId]/answers">) {
  const { runId } = await params;

  const review = await loadReview(runId);
  if (!review) notFound();

  const { owner, repo, commit_sha: commitSha } = review.run;

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
        {review.questions.map((question, qi) => {
          const chosen =
            question.selectedIndex === null
              ? null
              : question.options[question.selectedIndex];
          const answer = question.options[question.correctIndex];

          return (
            <article
              key={question.id}
              className="box-8bit p-5"
              style={
                {
                  "--box-edge": question.isCorrect
                    ? "rgba(74,222,128,0.45)"
                    : "rgba(255,84,112,0.45)",
                  "--box-bg": "rgba(20,17,54,0.6)",
                } as CSSProperties
              }
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
                <span className={`text-2xl ${question.isCorrect ? "text-[#4ade80]" : "text-[#ff5470]"}`}>
                  {question.isCorrect ? <Check /> : <Cross />}
                </span>
              </header>

              <div className="mt-4 flex flex-col gap-3">
                {!question.isCorrect && chosen ? (
                  <Explanation
                    kind="wrong"
                    heading={`You chose ${chosen.label}. ${chosen.text}`}
                    body={chosen.explanation}
                    citation={chosen.citation}
                    owner={owner}
                    repo={repo}
                    commitSha={commitSha}
                  />
                ) : null}

                {question.selectedIndex === null ? (
                  <p className="text-display text-sm text-[#b7b2e6]">
                    You did not answer this question.
                  </p>
                ) : null}

                <Explanation
                  kind="right"
                  heading={`Correct answer: ${answer.label}. ${answer.text}`}
                  body={answer.explanation}
                  citation={answer.citation}
                  owner={owner}
                  repo={repo}
                  commitSha={commitSha}
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
  commitSha,
}: {
  kind: "right" | "wrong";
  heading: string;
  body: string;
  citation: Citation | null;
  owner: string;
  repo: string;
  commitSha: string;
}) {
  const accent = kind === "right" ? "#4ade80" : "#ff5470";
  return (
    <div
      className="p-4"
      style={{
        // A single stepped edge on the left: the colour is the signal, so it
        // keeps the marker rather than boxing the text in on all four sides.
        boxShadow: `inset 4px 0 0 ${accent}`,
        background: "rgba(12,10,34,0.5)",
      }}
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
            commitSha={commitSha}
            citation={citation}
          />
        ) : (
          <LowConfidenceTag />
        )}
      </div>
    </div>
  );
}
