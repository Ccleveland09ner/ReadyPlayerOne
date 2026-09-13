/** Per-question progress pips shown beside the level name. */
export function ProgressPips({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Question ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-4 w-4"
          style={{
            background: i <= current ? "var(--color-lime)" : "#d3d6ec",
            boxShadow: i <= current ? "0 0 8px rgba(74,222,128,0.6)" : "none",
          }}
        />
      ))}
    </div>
  );
}
