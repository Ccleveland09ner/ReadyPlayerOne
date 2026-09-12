import { Heart } from "@/components/ui/Icons";

/** Three hearts; a wrong answer costs one. At zero the run ends early. */
export function Hearts({ remaining, total = 3 }: { remaining: number; total?: number }) {
  return (
    <div className="flex gap-1 text-2xl" aria-label={`${remaining} of ${total} hearts remaining`}>
      {Array.from({ length: total }).map((_, i) => (
        <Heart key={i} filled={i < remaining} />
      ))}
    </div>
  );
}
