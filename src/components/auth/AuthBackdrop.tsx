import type { ReactNode } from "react";

/** Deterministic starfield — same positions on server and client, no hydration drift. */
export const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 137.5) % 100,
  y: (i * 71.3) % 46,
  s: (i % 3) + 1,
  o: 0.4 + (i % 5) / 10,
}));

export function Starfield({ color = "#8fb4ff" }: { color?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.s,
            height: s.s,
            opacity: s.o,
            background: color,
          }}
        />
      ))}
    </div>
  );
}

/** Shared synthwave backdrop: starfield + neon perspective grid floor. */
export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: "linear-gradient(180deg,#141033 0%,#1a1140 55%,#0d0a24 100%)" }}
    >
      <Starfield />
      <div className="grid-floor pointer-events-none absolute inset-x-0 bottom-0 h-1/2" aria-hidden />
      <div className="animate-in relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
