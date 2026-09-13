import { MASTERY_TONE_COLOR, masteryFor } from "@/lib/progression/mastery";

/** Named mastery tier plus the segmented bar from the Quiz Complete mockup. */
export function MasteryBar({
  score,
  total,
  segments = 5,
}: {
  score: number;
  total: number;
  segments?: number;
}) {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const tier = masteryFor(percent);
  const color = MASTERY_TONE_COLOR[tier.tone];
  const filled = Math.round((percent / 100) * segments);

  return (
    <div>
      <div
        className="text-pixel text-lg"
        style={{ color, textShadow: `0 0 10px ${color}80` }}
      >
        {tier.name.toUpperCase()}!
      </div>
      <div className="mt-3 flex gap-2">
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            className="h-5 flex-1"
            style={{
              background: i < filled ? color : "#2a2358",
              boxShadow: i < filled ? `0 0 8px ${color}99` : "none",
            }}
          />
        ))}
      </div>
      <p className="text-pixel mt-3 text-[10px] leading-relaxed text-[#b7b2e6]">{tier.blurb}</p>
    </div>
  );
}
