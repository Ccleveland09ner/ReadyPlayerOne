# ReadyPlayerOne

Point it at any public GitHub repository and it turns that codebase into a
five-question quiz — the questions a new hire should be able to answer after day
one. Every answer choice carries an explanation bound to a verified
`path:start–end` citation in the actual source, so what you are told is
checkable rather than merely plausible. Hearts, streaks, XP and mastery ranks
accumulate across every repo you take on.

School grades the code you wrote. Industry grades the code you read.
ReadyPlayerOne turns "read the repo until you feel okay" into a measurable,
cited, repeatable exercise.

## Status

The pipeline works end to end against real repositories.

| Layer | State |
|---|---|
| All screens, routing, game shell | Built |
| Landing screen, 8-bit styling, sidebar logout | Built |
| Repository ingestion, chunking, embeddings | Built |
| Question generation, citation verification | Built |
| Answer scoring, run persistence, history, report | Built |
| Mastery tiers, XP and level derivation | Built |
| Accounts — sign up, sign in, claim anonymous runs | Built |
| Top-bar selector — replay any of your three most recent repos | Built |
| Production hardening — response headers, pinned function windows | Built |

Accounts are optional: anonymous play is the demo path, runs save to the
browser, and signing in later claims them. **This Supabase project has email
confirmation enabled**, so sign-up ends with "check your email" rather than a
session — turn *Confirm email* off under Authentication → Providers → Email if
you want sign-up to land straight on `/home`.

**Verified against 50 public repositories.** 36 completed end to end on the
first pass; the failures drove four real fixes (see
[Known behaviour](#known-behaviour)). Answer keys carried a verified citation
in 98% of completed runs.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The landing screen renders with no configuration
at all — the session-refresh guard skips itself when Supabase credentials are
absent, and read paths return empty states rather than throwing. To run an
actual quiz you need the keys in [Configuration](#configuration).

```bash
npm run verify         # lint, typecheck, tests and build — the whole gate
npm run build          # next build
npm run lint           # eslint
npm run typecheck      # tsc --noEmit (run a build first — Next generates route types)
npm test               # vitest, 131 tests
```

### Verification scripts

These run against a live Supabase project and are the fastest way to know the
backend is healthy. The last three spend money; the first two do not.

```bash
node scripts/verify-backend.mjs               # 22 checks: schema, RLS, cache key, vector retrieval
node scripts/verify-auth.mjs                  # 8 checks: sign-up, sign-in, claim-on-sign-in, profile RLS
node scripts/verify-auth-flow.mjs <baseUrl>   # 15 checks: the app's response to a session
node scripts/verify-screens.mjs <baseUrl>     # 25 checks: history, report, results, review, HUD
node scripts/verify-repo-selector.mjs <base>  # 7 checks: the top-bar dropdown and what it starts
node scripts/verify-retake.mjs <baseUrl>      # 14 checks: Try Again makes a real new attempt
node scripts/smoke-run.mjs <repo> <baseUrl>   # one repo end to end, every question + citation
node scripts/simulate-user.mjs <repo> <base>  # the whole journey, landing to logout
node scripts/batch-test.mjs <list> <baseUrl>  # many repos, the distribution of outcomes
```

`verify-*` scripts clean up after themselves. `smoke-run`, `simulate-user` and
`batch-test` spend real money on embeddings and generation.

## Structure

```
src/
├── app/
│   ├── layout.tsx                  root shell, next/font wiring
│   ├── globals.css                 palette, 8-bit primitives, pixel type
│   │
│   ├── (auth)/                     full-bleed, no dashboard chrome
│   │   ├── page.tsx                `/` — the landing screen, rocket hero
│   │   ├── login/  signup/         wired to Supabase via server actions
│   │
│   ├── (app)/                      everything inside the game shell
│   │   ├── home/                   `/home` — repo entry
│   │   ├── history/ report/ settings/
│   │   └── runs/[runId]/
│   │       ├── page.tsx            Ingesting — staged progress
│   │       ├── start/ quiz/ complete/ answers/
│   │
│   └── api/runs/…                  4 pipeline endpoints
│
├── components/
│   ├── shell/   DashboardShell, SideNav, TopBar, RepoSelector
│   ├── quiz/    Hearts, ProgressPips, StreakPanel
│   ├── auth/    AuthBackdrop, Field, OtpLoginForm (parked)
│   └── ui/      Panel, Brand, Icons, MasteryBar, CitationLink, Pager,
│                TrendChart, pixel-rocket-voyager, background-pixel-stars
│
├── lib/
│   ├── types.ts  schemas.ts  env.ts  runs.ts  log.ts
│   ├── api.ts                      server error envelopes
│   ├── api-client.ts               the browser's reader for them
│   ├── retry.ts  ratelimit.ts
│   ├── auth/                       server actions, session reads, validation
│   ├── github/                     URL parsing, tree fetch, filtering, caps
│   ├── index/                      chunking, embedding, retrieval
│   ├── quiz/                       generation, citation verification, reads
│   ├── identity/                   anon cookie, claim-on-sign-in
│   ├── progression/                mastery tiers, XP, levels
│   ├── history/                    run queries, report aggregate
│   └── supabase/                   browser, server and service clients
│
└── proxy.ts                        session refresh, anon cookie, landing gate

scripts/                            verification harnesses (see above)
supabase/
├── migrations/                     schema + the match_chunks lockdown
└── tests/schema-check.sql          structural assertions
docs/                               PRD, tech design, deployment, mockups
```

## Routes

| Route | Screen |
|---|---|
| `/` | **Landing** — rocket hero, `PRESS START` |
| `/login` `/signup` | Accounts |
| `/home` | Home — repo entry |
| `/runs/[runId]/start` | Confirm and start |
| `/runs/[runId]` | Ingesting — staged progress |
| `/runs/[runId]/quiz` | Quiz — question, options, HUD |
| `/runs/[runId]/complete` | Quiz Complete |
| `/runs/[runId]/answers` | Answer Review |
| `/history` `/report` `/settings` | |

**The landing screen is `/` itself, not a redirect to one.** Opening the site
shows it; `PRESS START` goes to `/login`; signing in lands on `/home`. A
browser that has not seen the landing screen and has no session is redirected
to `/` from anywhere else, so the intended order holds without the URL lying
about which screen you are on.

`/`, `/login`, `/signup`, `/logout` and `/api` are exempt from that redirect.
`/api` deliberately: the ingestion loop must never be redirected mid-run.

A signed-in visitor always passes, so a bookmarked `/history` opened in a new
browser goes straight there rather than being introduced to a product they
already use.

### Replaying a repository

Three places start a run — the form on `/home`, the repository chip in the top
bar, and **Try Again** on the results screen — and all three mean the same
thing: a **new** run. A finished run's URL is a record, not a game; its
questions are answered and its explanations are on screen.

- **The top-bar chip** is a dropdown of your three most recent repositories.
  Picking one lands on `/runs/:id/start`, the ordinary confirm → ingest → quiz
  path.
- **Try Again** skips the confirm screen and goes straight to `/runs/:id` —
  you confirmed this repository a minute ago, so *again* should mean again.

That sounds expensive and is not. The snapshot cache is keyed on the commit
SHA, so a repeat reuses the chunks and the manifest and regenerates only the
five questions: one model call, and a retake is a *different* quiz on the same
commit rather than the one whose answers you have just read. If the repository
has moved on since, the SHA differs, the cache misses and it indexes again —
which is correct, because a question has to describe the commit it was
generated from.

All three go through `startRun()` in `src/lib/api-client.ts`, which is the only
way the browser creates a run.

## How it works

The client orchestrates the pipeline, because ingesting a repository does not
fit inside one serverless invocation:

```
POST /api/runs                 resolve the commit SHA, fetch and filter the tree
POST /api/runs/:id/index       chunk + embed one batch  ← called in a loop
POST /api/runs/:id/questions   one model call, five cited questions
POST /api/runs/:id/answers     compare against the stored index — no model call
```

Three ideas carry the product:

**Citations are verified mechanically, at generation time.** A citation survives
only if its path is in the ingested snapshot, its line range is in bounds, its
span overlaps a chunk the model was actually shown, and it is under 80 lines. If
the *correct* option's citation fails — or the model declines to give one — the
quiz is regenerated, then the run fails. Nothing ever ships an answer key
without evidence behind it.

**Everything after generation is deterministic.** Scoring, hearts, streaks, XP,
mastery tiers and every number on the report — including the insight sentences —
are computed. None of it can hallucinate. AI touches exactly two places:
embeddings and one structured generation call.

**Progression is derived, never stored.** 10 XP per correct answer, 25 per
finished quiz, 100 per level, recomputed from the answer rows. Deleting a run
corrects every total for free.

## Configuration

`cp .env.example .env.local` and fill it in. Full table, Vercel mapping and
Supabase setup: [docs/BACKEND-DEPLOYMENT.md](./docs/BACKEND-DEPLOYMENT.md).

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | Session refresh |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Every write |
| `GITHUB_TOKEN` | Ingestion at any real rate |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Question generation. Defaults to `claude-haiku-4-5` |
| `EMBEDDING_API_KEY` / `..._BASE_URL` / `..._MODEL` | Indexing |

Anthropic serves no embeddings endpoint, so embeddings are a second provider.
The default model outputs 1536 dimensions to match `chunks.embedding`; changing
provider or model means migrating that column, and `embedBatch` asserts the
dimension rather than trusting it.

```bash
npx supabase link --project-ref <ref>
npx supabase db push --linked --dry-run
npx supabase db push --linked
node scripts/verify-backend.mjs
```

## Known behaviour

Found by running against 50 real repositories, and worth knowing before you
hit them again:

- **A repository with fewer than 5 readable source files is rejected.** Most
  single-README "awesome list" repos fail this way. It is the cap working, not
  a bug.
- **NUL bytes are stripped before storage.** PostgreSQL `text` cannot hold
  U+0000 and rejects the whole insert; one stray null byte used to kill a run.
- **Embedding inputs are capped and shrink on rejection.** The chunker bounds
  chunks by line *count*, which says nothing about line *length* — link-dense
  markdown blew past the model's token limit. A character cap is a guess, so
  the batch halves and retries when the provider says it is still too long.
- **A single-README repository may fail generation.** With nothing structural
  to retrieve, the model guesses `README.md:1-10` and verification correctly
  refuses it. Pinning the README's opening chunk into every topic's grounding
  would fix this.
- **Generation runs ~30s**, above the 20s target in the PRD. It sits behind the
  progress screen, so it is visible but not fatal.

## Design

The ten mockups in [`docs/mockups/`](./docs/mockups/) are the spec — where they
and the written docs disagree, the mockups win. Their README maps each screen to
its route and records where the implementation deliberately differs.

The palette, the pixel type and the 8-bit primitives live in
`src/app/globals.css`. Change a colour there, not in a component. The primitives
draw their stepped edges with layered `box-shadow` and zero border radius, and
take per-instance colours through CSS custom properties:

```tsx
<div className="box-8bit" style={{ "--box-edge": "#3a7bff" } as CSSProperties}>
```

`.panel-8bit`, `.box-8bit`, `.chip-8bit`, `.meter-8bit`, `.btn-8bit`.

Two canvas components back the atmosphere: `pixel-rocket-voyager` (Three.js,
landing only) and `background-pixel-stars` (2D canvas, behind the shell). Both
are decorative — they fall back to static rendering under
`prefers-reduced-motion`, the hero survives a missing WebGL context, and both
dispose their resources on unmount.

## Conventions

- **Components** are `PascalCase.tsx` under `src/components/`; page-scoped
  client components are kebab-case and colocated with their route.
- **Pages stay server components** where they can; interactivity goes in a
  colocated client component.
- **Snapshot indirection:** a cached or retaken run points at another run's
  chunks, so every query against `chunks` or `repo_files` must resolve through
  `snapshotIdOf()`, never `run.id`.
- **Mastery thresholds live in exactly one place** —
  `src/lib/progression/mastery.ts`. Three copies is how the screens end up
  disagreeing.
- **The answer key never reaches the browser.** `loadQuizForPlay` strips
  `correct_index` and every explanation; the answer route returns them on
  submit.
- **Client code reads API failures through `src/lib/api-client.ts`.** Routes
  answer with `{ error: { code, message, retryable } }`. Reading `payload.error`
  and putting it in React state puts an *object* there, and rendering an object
  as a child throws — so a mistyped repository URL used to take the screen down
  instead of reporting the problem. `errorMessage(payload, fallback)` is the
  one place that knows the shape.

## Working with an AI agent

This repo ships a Claude Code skill at
[`.claude/skills/worktree-pr/`](./.claude/skills/worktree-pr/SKILL.md). Run
`/worktree-pr` whenever an agent is about to make a change — it branches off
`main` into a separate `git worktree`, works there, verifies it builds, and
opens a PR, instead of editing your main checkout directly.

## Deploying

Vercel, free tier. Full walkthrough — environment mapping, Supabase setup,
error codes, cold-start numbers — in
[docs/BACKEND-DEPLOYMENT.md](./docs/BACKEND-DEPLOYMENT.md).

```bash
npm run verify                    # must be green before anything else
npx supabase db push --linked     # schema onto the production project
node scripts/verify-backend.mjs   # 22 checks against it
vercel --prod
```

What is already set up for production, so you do not have to wonder:

- **Response headers** (`next.config.ts`): `X-Frame-Options: DENY`,
  `nosniff`, `strict-origin-when-cross-origin` and a `Permissions-Policy`
  denying camera, microphone and geolocation. `x-powered-by` is off. There is
  deliberately no CSP — a useful one needs a per-request nonce, and a static
  one loose enough for Next's inlined bootstrap would advertise protection it
  does not provide.
- **Function windows are pinned, not inherited.** Generation gets 60s
  (it runs ~30s and retries once), indexing and run creation 60s, answer
  scoring 15s. Inheriting a platform default is how a working pipeline starts
  timing out on someone else's plan change.
- **The model default is the cheap one.** `claude-haiku-4-5` unless
  `ANTHROPIC_MODEL` says otherwise — the tier the 50-repository run was
  verified against.
- **A build fails on a type error.** `typescript.ignoreBuildErrors` is
  explicitly `false` so nobody can quietly flip it to turn a red build green.

Deploy early rather than discovering deployment bugs at hour 20, and warm the
demo repositories on production so the snapshot cache is populated and the demo
starts in seconds.

## Reference

- [PRD](./docs/PRD-ReadyPlayerOne-MVP.md) — features, scope, acceptance criteria
- [Technical design](./docs/TechDesign-ReadyPlayerOne-MVP.md) — schema, decisions, build sequence
- [Backend deployment](./docs/BACKEND-DEPLOYMENT.md) — env mapping, Supabase setup, error codes, cold start
- [Mockups](./docs/mockups/) — the ten reference screens
- [Next.js docs](https://nextjs.org/docs) · [Supabase docs](https://supabase.com/docs)
