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

## Status: skeleton

The interface is built and every screen renders. **The pipeline behind it is
not implemented yet** — the four API routes return `501`, and the screens read
typed placeholder data from `src/lib/mock-data.ts`.

| Layer | State |
|---|---|
| All 12 screens, routing, game shell | Built |
| Mastery tiers, XP and level derivation | Built (`src/lib/progression/mastery.ts`) |
| Repository ingestion, chunking, embeddings | Not started |
| Question generation, citation verification | Not started |
| Answer scoring, run persistence | Not started |
| Accounts, anonymous-run claiming | Not started |

Anything still to be written carries its contract in a docstring at the place
it belongs — the API stubs and the empty `src/lib/*` modules are specifications,
not empty files.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. **No Supabase project is needed to see the UI** —
the session-refresh proxy skips itself when credentials are absent, so every
screen renders unconfigured. Set Supabase up when you start writing the
pipeline, not before.

The quiz flow is clickable end to end against placeholder data: `/` → paste
anything → `/runs/demo/start` → `/runs/demo` → `/runs/demo/quiz` →
`/runs/demo/complete` → `/runs/demo/answers`.

```bash
npm run build     # next build
npm run lint      # eslint
npx tsc --noEmit  # type check (run a build first — Next generates the route types)
```

## Structure

```
src/
├── app/
│   ├── layout.tsx                  root shell, next/font wiring
│   ├── globals.css                 Tailwind v4 tokens + pixel primitives
│   │
│   ├── (auth)/                     full-bleed, no dashboard chrome
│   │   ├── splash/ login/ signup/
│   │
│   ├── (app)/                      everything inside the game shell
│   │   ├── page.tsx                Home — repo entry
│   │   ├── history/ report/ settings/
│   │   └── runs/[runId]/
│   │       ├── page.tsx            Ingesting — staged progress
│   │       ├── start/              Confirm and start
│   │       ├── quiz/               Quiz play
│   │       ├── complete/           Quiz Complete
│   │       └── answers/            Answer Review + citations
│   │
│   └── api/runs/…                  4 pipeline endpoints (stubbed 501)
│
├── components/
│   ├── shell/   DashboardShell, SideNav, TopBar
│   ├── quiz/    Hearts, ProgressPips, StreakPanel
│   ├── auth/    AuthBackdrop, Field, OtpLoginForm
│   └── ui/      Panel, Brand, Icons, MasteryBar, CitationLink, Pager, TrendChart
│
├── lib/
│   ├── types.ts                    domain shapes shared by UI and pipeline
│   ├── mock-data.ts                placeholder content — delete as queries land
│   ├── progression/mastery.ts      mastery tiers, XP, levels
│   ├── schemas.ts                  Zod validation (pending)
│   ├── github/  index/  quiz/      ingestion, retrieval, generation (pending)
│   ├── identity/ history/          anon cookie, run queries (pending)
│   └── supabase/                   browser + server clients
│
└── proxy.ts                        session refresh (Next 16's middleware.ts)

docs/
├── PRD-ReadyPlayerOne-MVP.md       product spec, features, scope
├── TechDesign-ReadyPlayerOne-MVP.md  architecture, schema, decisions
└── mockups/                        the ten reference screens + README
```

## Routes

| Route | Screen | Tier |
|---|---|---|
| `/` | Home — repo entry | P0 |
| `/runs/[runId]/start` | Confirm and start | P0 |
| `/runs/[runId]` | Ingesting — staged progress | P0 |
| `/runs/[runId]/quiz` | Quiz — question, options, HUD | P0 |
| `/runs/[runId]/complete` | Quiz Complete | P0 |
| `/runs/[runId]/answers` | Answer Review | P0 |
| `/history` | Quiz History | P0 |
| `/report` | Reports dashboard | P1 |
| `/settings` | Settings | P1/P2 |
| `/splash` `/login` `/signup` | Splash and accounts | P1 |

`/splash` is its own route rather than the unauthenticated `/` the PRD
describes — anonymous play is the demo path, so `/` is Home. Swapping it is a
redirect in `proxy.ts` once accounts exist.

## How it is meant to work

The client orchestrates the pipeline, because ingesting a repository does not
fit inside one serverless invocation:

```
POST /api/runs                 resolve the commit SHA, fetch and filter the tree
POST /api/runs/:id/index       chunk + embed one batch  ← called in a loop
POST /api/runs/:id/questions   one model call, five cited questions
POST /api/runs/:id/answers     compare against the stored index — no model call
```

Two ideas carry the product:

**Citations are verified mechanically, at generation time.** A citation survives
only if its path is in the snapshot, its line range is in bounds, its span
overlaps a chunk the model was actually shown, and it is under 80 lines. A
question whose correct option loses its citation is regenerated, then fails the
run. Nothing ever displays an unverified citation, in any failure mode.

**Everything after generation is deterministic.** Scoring, hearts, streaks, XP,
mastery tiers and every number on the report — including the insight sentences —
are computed. None of it can hallucinate. AI touches exactly two places:
embeddings and one structured generation call.

**Progression is derived, never stored.** 10 XP per correct answer, 25 per
finished quiz, 100 per level, recomputed from the answer rows. Deleting a run
corrects every total for free.

## Design

The ten mockups in [`docs/mockups/`](./docs/mockups/) are the spec — where they
and the written docs disagree, **the mockups win**. Their README maps each
screen to its route and records where the implementation deliberately differs.

The palette, the pixel panel/button/input primitives and the three fonts live in
`src/app/globals.css`. Change a color there, not in a component. Fonts load
through `next/font` (Press Start 2P for display and HUD, Fredoka for headings,
Nunito for body) and feed Tailwind v4 theme tokens.

Two accessibility traps worth remembering: pixel fonts at small sizes and
neon-on-dark both fail contrast easily. Body copy stays at a normal size, and
every pairing gets checked at AA before a styling pass is called done.

## Conventions

- **Components** are `PascalCase.tsx` under `src/components/`; page-scoped client
  components are kebab-case and colocated with their route (`quiz-player.tsx`).
- **Pages stay server components** where they can; interactivity goes in a
  colocated client component so the page can start querying the database without
  a rewrite.
- **Snapshot indirection:** a cached or retaken run points at another run's
  chunks, so every query against `chunks` or `repo_files` must resolve through
  `effectiveSnapshotId()` in `src/lib/index/`, never `run.id`.
- **Mastery thresholds live in exactly one place** — `src/lib/progression/mastery.ts`.
  Three copies of the table is how the screens end up disagreeing.

## Supabase setup

Needed once you start on the pipeline, not to run the UI.

1. Create your own project at [supabase.com/dashboard](https://supabase.com/dashboard)
   (Free plan). Every team member does **not** share one.
2. `cp .env.example .env.local`, then fill the three values from
   **Settings → API**: project URL, `anon` key, and the `service_role` key —
   which is secret, server-only, and never committed.
3. Enable the `vector` extension and apply migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --linked
   ```
4. A `GITHUB_TOKEN` (classic, no scopes) is strongly recommended before
   deploying — unauthenticated GitHub API limits are per-IP, and on Vercel that
   IP is shared.

The starter template's `todos` table and its wide-open RLS policies are still in
`supabase/migrations/` and should be dropped in the first real migration. The
template's working email-OTP form is parked, unused, at
`src/components/auth/OtpLoginForm.tsx`; the pixel login and signup screens are
presentational until password auth is wired.

## Working with an AI agent

This repo ships a Claude Code skill at
[`.claude/skills/worktree-pr/`](./.claude/skills/worktree-pr/SKILL.md). Run
`/worktree-pr` whenever an agent is about to make a change — it branches off
`main` into a separate `git worktree`, works there, verifies it builds, and
opens a PR, instead of editing your main checkout directly.

## Deploying

Vercel, free tier. Set the same environment variables from `.env.local` in the
project dashboard. Deploy early — at hour 4, before there is anything to demo —
rather than discovering deployment bugs at hour 20.

## Reference

- [PRD](./docs/PRD-ReadyPlayerOne-MVP.md) — features, scope, acceptance criteria
- [Technical design](./docs/TechDesign-ReadyPlayerOne-MVP.md) — schema, decisions, build sequence
- [Mockups](./docs/mockups/) — the ten reference screens
- [Next.js docs](https://nextjs.org/docs) · [Supabase docs](https://supabase.com/docs)
