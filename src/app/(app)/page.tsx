import { Panel } from "@/components/ui/Panel";
import { RepoEntryForm } from "./repo-entry-form";

/** Screen 4 — Home, repo entry. */
export default function HomePage() {
  return (
    <Panel tone="light" className="max-w-3xl p-8 sm:p-12">
      <div className="text-ink flex flex-col items-center text-center">
        <h1 className="text-pixel text-2xl leading-tight sm:text-3xl">Would you kindly...?</h1>
        <p className="text-pixel mt-3 text-[11px] leading-relaxed tracking-wide text-[#43406b] sm:text-xs">
          Enter the Git repository you want to be quizzed on.
        </p>
        <RepoEntryForm />
        <p className="text-pixel mt-6 max-w-xl text-[9px] leading-relaxed tracking-wide text-[#7b76ad]">
          Public repositories only. Repository content is sent to a model provider to
          generate your questions.
        </p>
      </div>
    </Panel>
  );
}
