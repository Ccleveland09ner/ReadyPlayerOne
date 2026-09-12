import Link from "next/link";
import { BranchIcon, CodeIcon, DocIcon, Play } from "@/components/ui/Icons";
import { Panel } from "@/components/ui/Panel";
import { MOCK_REPO } from "@/lib/mock-data";

/** Screen 5 — confirm the repo and start. */
export default async function StartPage({ params }: PageProps<"/runs/[runId]/start">) {
  const { runId } = await params;

  // TODO: read the run row for owner/repo/question_count instead of the mock.
  const rows = [
    {
      Icon: BranchIcon,
      label: "Repository",
      value: `https://github.com/${MOCK_REPO.owner}/${MOCK_REPO.repo}`,
    },
    { Icon: CodeIcon, label: "Quiz Type", value: "Code Understanding" },
    { Icon: DocIcon, label: "Questions", value: "5 Questions" },
  ];

  return (
    <Panel tone="light" className="max-w-3xl p-8 sm:p-10">
      <div className="text-ink text-center">
        <h1 className="text-display text-4xl font-bold sm:text-5xl">Would you kindly...</h1>
        <p className="text-display text-4xl font-bold text-[#6d4aff] sm:text-5xl">start?</p>
      </div>

      <div className="mx-auto mt-8 max-w-xl overflow-hidden rounded-xl" style={{ border: "2px solid #c8cbe6" }}>
        {rows.map(({ Icon, label, value }, i) => (
          <div
            key={label}
            className="flex items-center gap-4 px-4 py-4"
            style={{
              borderTop: i ? "2px solid #d5d8ee" : "none",
              background: i % 2 ? "#e9ebf7" : "#f2f3fb",
            }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#dfe2f4] text-xl text-[#6d4aff]">
              <Icon />
            </span>
            <span className="text-display w-32 text-lg font-semibold text-[#43406b]">{label}</span>
            <span className="text-display text-ink flex-1 truncate text-lg font-medium">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
        <Link href="/" className="btn-pixel btn-ghost-light">
          CHANGE REPOSITORY
        </Link>
        <Link href={`/runs/${runId}`} className="btn-pixel btn-gold">
          START QUIZ <Play className="text-xs" />
        </Link>
      </div>
    </Panel>
  );
}
