import { Panel } from "@/components/ui/Panel";
import { RepoEntryForm } from "./repo-entry-form";

/** Screen 4 — Home, repo entry. */
export default function HomePage() {
  return (
    <Panel tone="light" className="max-w-3xl p-8 sm:p-12">
      <div className="text-ink flex flex-col items-center text-center">
        <h1 className="text-display text-4xl font-bold sm:text-5xl">Would you kindly...?</h1>
        <p className="text-display mt-3 text-lg font-medium text-[#43406b]">
          Enter the Git repository you want to be quizzed on.
        </p>
        <RepoEntryForm />
        <p className="text-display mt-6 text-xs text-[#7b76ad]">
          Public repositories only. Repository content is sent to a model provider to
          generate your questions.
        </p>
      </div>
    </Panel>
  );
}
