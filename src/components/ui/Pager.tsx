import Link from "next/link";

/** Offset pagination controls for /history — `?page=n`, 10 rows per page. */
export function Pager({
  page,
  pageCount,
  basePath,
}: {
  page: number;
  pageCount: number;
  basePath: string;
}) {
  const prev = Math.max(1, page - 1);
  const next = Math.min(pageCount, page + 1);
  const linkClass =
    "text-pixel rounded-md px-3 py-2 text-[10px] transition";
  const enabled = { color: "#cfc8ff", border: "2px solid rgba(124,92,255,0.5)" };
  const disabled = { color: "#5a5588", border: "2px solid #241f52", pointerEvents: "none" as const };

  return (
    <div className="mt-5 flex items-center justify-center gap-4">
      <Link
        href={`${basePath}?page=${prev}`}
        className={linkClass}
        style={page <= 1 ? disabled : enabled}
        aria-disabled={page <= 1}
      >
        ◀ PREV
      </Link>
      <span className="text-pixel text-[10px] text-[#8fa0e6]">
        PAGE {page} / {pageCount}
      </span>
      <Link
        href={`${basePath}?page=${next}`}
        className={linkClass}
        style={page >= pageCount ? disabled : enabled}
        aria-disabled={page >= pageCount}
      >
        NEXT ▶
      </Link>
    </div>
  );
}
