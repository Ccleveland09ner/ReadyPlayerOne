import type { ReactNode } from "react";
import { PixelVoyagerCanvas } from "@/components/ui/pixel-rocket-voyager";

/**
 * Shared backdrop for log in and create-profile.
 *
 * Uses the same rocket-and-starfield scene as the landing page so the three
 * screens in the entry flow read as one place. The pointer steering is off
 * here: over a form the rocket should stay out of the way.
 */
export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#100c26] px-4 py-10">
      <PixelVoyagerCanvas interactive={false} />
      <div className="animate-in relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
