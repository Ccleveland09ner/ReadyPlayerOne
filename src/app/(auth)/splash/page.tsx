import { PixelRocketHero } from "@/components/ui/pixel-rocket-voyager";

/**
 * The landing screen — the first thing a visitor sees.
 *
 * proxy.ts sends anyone without the seen-splash cookie here, so the order is
 * landing -> log in or create a profile -> Home. The PRD puts this at `/` and
 * Home behind it; here `/` stays Home and the redirect does the same job, so
 * anonymous play remains reachable in one click.
 *
 * Stays a server component; the hero owns the client boundary because of the
 * canvas and the entrance animation.
 */
export default function SplashPage() {
  return <PixelRocketHero />;
}
