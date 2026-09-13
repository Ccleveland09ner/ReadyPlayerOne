import type { NextConfig } from "next";

/**
 * Response headers applied to every route.
 *
 * None of these are the security boundary -- RLS, the service-role split and
 * the server-side answer key are. They close the cheap gaps a scanner will
 * find first, and they cost nothing at runtime.
 *
 * No Content-Security-Policy here on purpose. A useful one needs a per-request
 * nonce, which means generating it in `proxy.ts` and threading it through the
 * root layout; a static one loose enough for Next's inlined bootstrap script
 * (`unsafe-inline`) would advertise protection it does not provide.
 */
const securityHeaders = [
  // The two canvas backdrops and the fonts are same-origin; nothing embeds
  // this app, so framing it is only useful for clickjacking it.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Repository URLs end up in the path on /runs/:id -- do not leak them to
  // github.com when a citation link is followed.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // Nothing gained by announcing the framework version to a scanner.
  poweredByHeader: false,

  // A build that type-errors must not reach production. This is the default;
  // stating it means nobody can quietly flip it to get a red build green.
  // There is no `eslint` counterpart -- Next 16 removed `next lint`, so
  // linting is `npm run lint` and belongs to CI, not to the build.
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
