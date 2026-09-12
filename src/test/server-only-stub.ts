/**
 * Stand-in for the `server-only` package under vitest.
 *
 * The real package throws when it resolves to a client build, which is exactly
 * what happens in a plain node test environment. Aliasing it here lets the
 * tests import server modules (github, env) without weakening the guard in
 * the app itself -- the real import is still in place for the Next build.
 */
export {};
