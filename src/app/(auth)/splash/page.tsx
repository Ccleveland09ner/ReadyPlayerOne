import Link from "next/link";
import { AuthWordmark } from "@/components/ui/Brand";
import { Starfield } from "@/components/auth/AuthBackdrop";

/**
 * The "click to continue" title card.
 *
 * The PRD puts the splash at `/` for unauthenticated visitors and Home at `/`
 * once you are in. Anonymous play is the demo path, so `/` is Home here and
 * the splash lives at its own route; the swap is a proxy.ts redirect when
 * accounts land.
 */
export default function SplashPage() {
  return (
    <Link
      href="/login"
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4"
      style={{ background: "radial-gradient(1000px 600px at 50% 12%,#2a1a5e,#120c33 70%)" }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Starfield color="#9cc0ff" />
        {/* retro sun — sits behind the wordmark with a warm neon glow */}
        <div
          className="absolute top-[20%] left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "linear-gradient(180deg,#ffe27a,#ffab3c 45%,#ff5a8a 80%,#ff3fa4)",
            boxShadow:
              "0 0 90px 30px rgba(255,138,60,0.55), 0 0 40px rgba(255,63,164,0.5)",
          }}
        />
        <div className="grid-floor absolute inset-x-0 bottom-0 h-[46%]" />
      </div>
      <div className="animate-in relative z-10">
        <AuthWordmark />
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="text-pixel text-lg text-[#ff4fa3]">▶▶▶</span>
          <span
            className="text-pixel animate-blink px-6 py-3 text-sm text-white"
            style={{
              border: "3px solid var(--color-magenta)",
              borderRadius: 6,
              background: "rgba(20,10,40,0.6)",
              textShadow: "0 0 8px rgba(255,79,163,0.8)",
            }}
          >
            CLICK TO CONTINUE
          </span>
          <span className="text-pixel text-lg text-[#ff4fa3]">◀◀◀</span>
        </div>
      </div>
    </Link>
  );
}
