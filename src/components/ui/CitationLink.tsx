import { citationLabel, citationUrl, type Citation } from "@/lib/types";

/**
 * Renders `path:start–end` linking to a GitHub permalink pinned to the
 * ingested commit. A citation that failed verification is never passed here —
 * the caller labels that option low-confidence instead.
 */
export function CitationLink({
  owner,
  repo,
  commitSha,
  citation,
}: {
  owner: string;
  repo: string;
  commitSha: string;
  citation: Citation;
}) {
  return (
    <a
      href={citationUrl(owner, repo, commitSha, citation)}
      target="_blank"
      rel="noreferrer noopener"
      className="text-pixel inline-flex items-center gap-2 rounded-md px-2 py-1 text-[10px] text-[#7cc7ff] underline-offset-4 transition hover:text-white hover:underline"
      style={{ background: "rgba(58,123,255,0.12)", border: "1.5px solid rgba(58,123,255,0.4)" }}
    >
      {citationLabel(citation)}
    </a>
  );
}

/** Shown in place of a citation when verification stripped it. */
export function LowConfidenceTag() {
  return (
    <span
      className="text-pixel inline-block rounded-md px-2 py-1 text-[9px] text-[#ffc23c]"
      style={{ border: "1.5px solid rgba(255,194,60,0.5)" }}
    >
      LOW CONFIDENCE — NO VERIFIED CITATION
    </span>
  );
}
