import { PixelRocketHero } from "@/components/ui/pixel-rocket-voyager";

/**
 * The landing screen, at `/` — the first thing anyone sees.
 *
 * This is the order the PRD asks for, with the URLs saying so rather than a
 * redirect implying it: `/` is the landing, `/login` and `/signup` come next,
 * and the app itself starts at `/home`.
 *
 * Stays a server component; the hero owns the client boundary because of the
 * canvas and the entrance animation.
 */
export default function LandingPage() {
  return <PixelRocketHero />;
}
