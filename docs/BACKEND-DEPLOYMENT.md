# Backend Deployment

Everything needed to take the pipeline from a fresh clone to a working
deployment, and to check it actually works once it is there.

## Environment variables

| Variable | Where it comes from | Scope | Required for |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | Client + server | Everything except the static screens |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` key | Client + server | Auth session refresh |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` key | **Server only** | Every write; all four pipeline routes |
| `GITHUB_TOKEN` | github.com/settings/tokens → classic, **no scopes** | Server only | Ingestion at any real rate |
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys | Server only | Question generation |
| `ANTHROPIC_MODEL` | optional | Server only | Overriding the `claude-opus-5` default |
| `EMBEDDING_API_KEY` | platform.openai.com/api-keys | Server only | Indexing |
| `EMBEDDING_BASE_URL` | optional | Server only | Pointing at a non-OpenAI provider |
| `EMBEDDING_MODEL` | optional | Server only | Overriding `text-embedding-3-small` |

### Vercel

Set them under **Project → Settings → Environment Variables**, ticking
Production, Preview and Development for each.

```bash
# Or from the CLI, one at a time (it prompts for the value):
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add GITHUB_TOKEN production
vercel env add ANTHROPIC_API_KEY production
vercel env add EMBEDDING_API_KEY production
```

Two rules that matter more than they look:

- **Only the two `NEXT_PUBLIC_` values may ever be public.** Anything else
  prefixed `NEXT_PUBLIC_` gets inlined into the browser bundle. The service
  role key bypasses Row Level Security entirely — putting it there hands every
  visitor write access to every table.
- **A `GITHUB_TOKEN` is close to mandatory in production.** Unauthenticated
  GitHub API requests are limited per IP, and on Vercel that IP is shared with
  every other deployment on the instance. Without a token you are drawing from
  a bucket strangers are also drinking from. A classic token with no scopes is
  enough for public repositories and takes two minutes to create.

## Supabase project setup

```bash
# 1. Create a project (Free plan is fine) at supabase.com/dashboard
# 2. Link this repo to it
npx supabase login
npx supabase link --project-ref <your-project-ref>

# 3. Apply the schema. --dry-run first is a habit worth keeping.
npx supabase db push --linked --dry-run
npx supabase db push --linked

# 4. Confirm it landed
npx supabase migration list --linked
```

`db push` applies three migrations in order: the starter template's `todos`
table, the ReadyPlayerOne schema (which drops `todos` along with its public
read/insert policies), and a lockdown that revokes `match_chunks` from the
`PUBLIC` role. The `vector` extension is enabled by the schema migration;
nothing needs enabling by hand in the dashboard.

That third migration exists because `revoke ... from anon, authenticated` reads
like a lockdown and is not one: PostgreSQL grants `EXECUTE` on every new
function to `PUBLIC`, so revoking from two named roles leaves the real grant
untouched. Verified against a live project -- `anon` could still call it.

### Verifying the deployed schema

```bash
node scripts/verify-backend.mjs
```

22 checks against the live project over PostgREST — the same path the app
uses. It covers what a migration file cannot prove on its own:

- every table and the view respond, and `todos` is gone
- `anon` cannot read `chunks`, cannot write anything, cannot call
  `match_chunks`, but **can** read a run by id (the capability-URL model)
- the partial unique index collides on a second *ready* snapshot of the same
  commit, and does **not** collide for an in-progress run or a retake
- constraints reject inverted line ranges, line 0, non-four-option questions,
  unknown topics and duplicate answers
- `match_chunks` orders by cosine distance, is scoped to one run, and honours
  its match count
- deleting a run cascades to its chunks, questions and answers

It creates rows under `owner = 'verify'` and deletes them on the way out.

## Routing gate

`proxy.ts` does three things on every request: refresh the Supabase session,
mint the `rpo_aid` anonymous identity cookie, and redirect first-time visitors
to the landing screen.

Open prefixes -- reachable without the `rpo_seen` cookie:

```
/splash  /login  /signup  /logout  /api
```

**`/api` being exempt is load-bearing, not incidental.** Ingestion is a client
orchestrated loop of `POST /api/runs/:id/index` calls; if those were gated, a
run would be redirected to the landing screen halfway through indexing and die
there. Anything added under `/api` inherits the exemption. Anything added
outside it does not -- including new pages, which will 307 until the visitor has
seen the landing screen.

Server-side callers that fetch *pages* need the cookie. `scripts/verify-screens.mjs`
sends `rpo_aid=<uuid>; rpo_seen=1` for exactly this reason; without it every
assertion runs against a redirect body.

## Cold-start behaviour

Measured on a production build (`next build && next start`) against the live
Supabase project, first request to each route:

| Route | Cold | Notes |
|---|---|---|
| `GET /splash` | ~8ms | Static, no database |
| `GET /report` | ~120ms | One grouped query |
| `GET /history` | ~1.0s | First database round trip pays connection setup |
| `POST /api/runs` | ~0.9–1.2s | Two GitHub calls plus the tree fetch |
| `POST /api/runs/:id/index` | ~1.5s/batch | Dominated by the embedding call |
| `POST /api/runs/:id/answers` | ~110ms | No model call — a comparison and two writes |

The first database-touching request in a cold lambda pays the PostgREST
connection; subsequent ones do not. Nothing here is near the serverless
execution ceiling, which is the point of batching ingestion rather than doing
it in one request.

## Error envelope

Every route answers in one shape, so the client branches on a stable code
rather than matching prose:

```json
{ "error": { "code": "repo_too_small", "message": "...", "retryable": false,
             "details": { "included": 3, "required": 5 } } }
```

| Code | Status | Retryable | Means |
|---|---|---|---|
| `bad_request` | 400 | no | Malformed input |
| `not_found` | 404 | no | Unknown run or question |
| `repo_unavailable` | 404 | no | Private, nonexistent, or not GitHub |
| `repo_too_small` | 422 | no | Fewer than 5 readable source files |
| `github_rate_limited` | 429 | yes | Set a `GITHUB_TOKEN` |
| `rate_limited` | 429 | yes | Per-caller or per-run cap hit |
| `embedding_failed` | 502 | yes | Embedding provider unreachable |
| `generation_failed` | 422 | no | Model output failed validation or citation checks |
| `not_configured` | 500 | no | A required environment variable is missing — the message names it |
| `internal` | 500 | yes | Logged server-side, generic to the caller |

## Rate limits and budgets

Two different things, both in `src/lib/ratelimit.ts`:

- **Per-caller:** `POST /api/runs` allows 10 per 5 minutes per IP. It is the
  route that spends GitHub quota and embedding credits.
- **Per-process outbound:** 120 GitHub requests/minute and 20 model
  requests/minute. These cap how hard one instance leans on a provider.
- **Per-run:** 40 embedding calls, enforced in the index route, so one
  pathological repository cannot drain credits.

The store is in-process. On serverless that means per-instance, not global: it
blunts a single abusive client on a warm instance and does nothing against a
distributed flood. For judging-day scale that is the right trade. Moving the
counters to Postgres or Upstash is the upgrade path, and the interface does
not need to change.

## Logging

One line of JSON per event (`src/lib/log.ts`), so Vercel's log view can be
filtered by `runId` or `event` instead of read as prose:

```json
{"level":"info","event":"ingest.batch","at":"...","runId":"...","filesIndexed":8,"chunkCount":56,"done":false,"ms":1503,"ok":true}
```

Events: `run.create`, `run.cached`, `run.fail`, `ingest.tree`, `ingest.batch`,
`ingest.file_skip`, `ingest.done`, `embed.retry`, `embed.batch`,
`generate.call`, `generate.verify`, `generate.reject`, `generate.done`,
`answer.score`, `ratelimit.block`.

Timings are the point: the targets are 90 seconds of ingestion and 20 of
generation, and you cannot tell whether you are hitting them without per-stage
numbers. Nothing logs secrets or repository file contents.

## Deploy order

1. `npm install` -- the landing screen added `three`, `@types/three` and
   `framer-motion`, so a checkout from before that commit needs a fresh install
2. Supabase project created and `db push` applied
3. `node scripts/verify-backend.mjs` passes
4. Environment variables set in Vercel
5. Push to `main` → Vercel builds
6. Warm the demo repositories on production so the snapshot cache is populated
   and the demo starts in seconds
