import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BranchIcon, CodeIcon, DocIcon, Play } from "@/components/ui/Icons";
import { Panel } from "@/components/ui/Panel";
import { loadRun } from "@/lib/runs";

/** Screen 5 — confirm the repo and start. */
export default async function StartPage({ params }: PageProps<"/runs/[runId]/start">) {
  const { runId } = await params;
  const run = await loadRun(runId);
  if (!run) notFound();

  const rows = [
    {
      Icon: BranchIcon,
      label: "Repository",
      value: `https://github.com/${run.owner}/${run.repo}`,
    },
    { Icon: CodeIcon, label: "Quiz Type", value: "Code Understanding" },
    { Icon: DocIcon, label: "Questions", value: `${run.question_count} Questions` },
  ];

  return (
    <Panel tone="light" className="max-w-3xl p-8 sm:p-10">
      <div className="text-ink text-center">
        <h1 className="text-pixel text-lg leading-[1.6] sm:text-2xl sm:leading-[1.6]">Would you kindly...</h1>
        <p className="text-pixel mt-2 text-lg text-[#6d4aff] sm:text-2xl">start?</p>
      </div>

      <div
        className="box-8bit mx-auto mt-8 max-w-xl overflow-hidden"
        style={
          {
            "--box-bg": "transparent",
            "--box-edge": "#c2c6e2",
            "--box-hi": "rgba(255,255,255,0.85)",
            "--box-lo": "rgba(0,0,0,0.12)",
          } as CSSProperties
        }
      >
        {rows.map(({ Icon, label, value }, i) => (
          <div
            key={label}
            className="flex items-center gap-4 px-4 py-4"
            style={{
              borderTop: i ? "2px solid #d5d8ee" : "none",
              background: i % 2 ? "#e9ebf7" : "#f2f3fb",
            }}
          >
            <span
              className="chip-8bit flex h-11 w-11 items-center justify-center text-xl text-[#6d4aff]"
              style={{ "--chip-bg": "#dfe2f4", "--chip-edge": "#c2c6e2" } as CSSProperties}
            >
              <Icon />
            </span>
            <span className="text-pixel w-32 text-[10px] leading-relaxed text-[#43406b]">{label}</span>
            <span className="text-pixel text-ink flex-1 truncate text-[10px]">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
        <Link href="/home" className="btn-pixel btn-8bit btn-ghost-light">
          CHANGE REPOSITORY
        </Link>
        <Link href={`/runs/${runId}`} className="btn-pixel btn-8bit btn-gold">
          START QUIZ <Play className="text-xs" />
        </Link>
      </div>
    </Panel>
  );
}
