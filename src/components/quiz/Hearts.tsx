import { Heart } from "@/components/ui/Icons";

/**
 * Three hearts; a wrong answer costs one. At zero the run ends early.
 *
 * Sized at an exact multiple of the sprite grid (12px cells at 2x) rather than
 * a type scale step: an in-between size lands the cell edges on half pixels and
 * the outline goes soft, which is the one thing pixel art cannot survive.
 */
export function Hearts({ remaining, total = 3 }: { remaining: number; total?: number }) {
  return (
    <div
      className="flex gap-1.5 text-[24px]"
      aria-label={`${remaining} of ${total} hearts remaining`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <Heart key={i} filled={i < remaining} />
      ))}
    </div>
  );
}
