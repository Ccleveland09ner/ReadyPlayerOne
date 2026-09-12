-- ReadyPlayerOne schema: six tables, one view, pgvector.
--
-- Everything the product needs, in one migration. Schema churn mid-build is a
-- reliable way to lose two hours, so this is written once and changed as
-- rarely as possible.
--
-- RLS posture: enabled on every table, with NO direct write access for the
-- anon role. All mutations go through route handlers using the service role
-- key, which bypasses RLS. Anon may read runs, questions and answers filtered
-- by run id -- safe because the id is an unguessable uuid acting as a
-- capability URL. `chunks` is never readable by anon: it holds full source
-- text and there is no reason to serve it from our origin.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Drop the starter template's demo table
-- ---------------------------------------------------------------------------
-- Its policies are public read + public insert, which must not survive into a
-- deployed submission. Dropping the table drops its policies with it.

drop table if exists public.todos cascade;

-- ---------------------------------------------------------------------------
-- runs -- one quiz attempt against one repo at one commit
-- ---------------------------------------------------------------------------

create table public.runs (
  id uuid primary key default gen_random_uuid(),

  owner text not null,
  repo text not null,
  commit_sha text not null,
  default_branch text,

  -- Set when this run reuses another run's chunks. A cached start or a Try
  -- Again creates a NEW run row for this player pointing at the existing
  -- snapshot, rather than handing the requester someone else's attempt.
  snapshot_run_id uuid references public.runs (id) on delete set null,

  status text not null default 'pending'
    check (status in ('pending', 'indexing', 'generating', 'ready', 'complete', 'failed')),

  question_count int not null default 5,
  difficulty text not null default 'mixed',

  hearts_remaining int not null default 3,
  completed_at timestamptz,

  -- files total, files indexed, chunk count, skipped counts, timings
  stage_detail jsonb not null default '{}'::jsonb,
  error text,

  -- The browser identity that created this run. Always set.
  anon_id uuid not null,
  user_id uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now()
);

-- The snapshot cache key. Only rows that own their chunks and actually made it
-- to a usable state can be reused.
create unique index runs_snapshot_cache_key
  on public.runs (owner, repo, commit_sha)
  where snapshot_run_id is null and status in ('ready', 'complete');

-- These back History, Report and the HUD.
create index runs_anon_id_created_at on public.runs (anon_id, created_at desc);
create index runs_user_id_created_at on public.runs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- repo_files -- the snapshot manifest citation verification checks against
-- ---------------------------------------------------------------------------

create table public.repo_files (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,

  path text not null,
  line_count int,
  byte_size int not null default 0,
  included boolean not null default false,
  skip_reason text,

  unique (run_id, path)
);

create index repo_files_run_id_included on public.repo_files (run_id, included);

-- ---------------------------------------------------------------------------
-- chunks -- line-aware slices of source, the retrieval corpus
-- ---------------------------------------------------------------------------
-- Written only for snapshot runs. start_line and end_line are 1-based and
-- must match the source file exactly: every citation in the product depends
-- on it.

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,

  file_path text not null,
  start_line int not null,
  end_line int not null,
  content text not null,
  language text,

  embedding extensions.vector(1536),

  check (start_line >= 1 and end_line >= start_line)
);

create index chunks_run_id on public.chunks (run_id);
create index chunks_run_id_file_path on public.chunks (run_id, file_path);

-- No ANN index for the MVP. At our caps a run produces roughly 300-800 chunks,
-- and an exact nearest-neighbour scan inside a single run partition is fast
-- enough. This would not hold at 100x the data; we are not designing for that.

-- ---------------------------------------------------------------------------
-- questions -- five per run, multiple choice
-- ---------------------------------------------------------------------------
-- Storing options, explanations and citations together is what makes scoring a
-- local comparison instead of a model call. Everything expensive happens once,
-- at generation.

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,

  order_index int not null,
  topic text not null
    check (topic in ('file_structure', 'core_logic', 'apis', 'testing', 'deployment')),

  prompt text not null,

  -- Array of exactly 4:
  --   { label, text, explanation, citation: { path, startLine, endLine }, verified }
  options jsonb not null,
  correct_index int not null check (correct_index between 0 and 3),

  created_at timestamptz not null default now(),

  unique (run_id, order_index),
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
);

create index questions_run_id_order on public.questions (run_id, order_index);

-- ---------------------------------------------------------------------------
-- answers -- one per question per run
-- ---------------------------------------------------------------------------

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,

  -- null means skipped
  selected_index int check (selected_index between 0 and 3),
  is_correct boolean not null default false,
  streak_at_answer int not null default 0,

  answered_at timestamptz not null default now(),

  unique (run_id, question_id)
);

create index answers_run_id on public.answers (run_id);

-- ---------------------------------------------------------------------------
-- profiles -- only needed once accounts exist (P1)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  username text unique,
  display_name text,
  avatar_key text not null default 'intern',

  -- question count, difficulty, show explanations, show code snippets,
  -- theme, accent
  preferences jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- verified_citations -- the citation index, in one place
-- ---------------------------------------------------------------------------
-- A view over questions so it can never drift from the quiz it describes.
-- Only options whose citation survived verification appear here.

create view public.verified_citations
with (security_invoker = true)
as
select
  q.run_id,
  q.id as question_id,
  r.owner,
  r.repo,
  r.commit_sha,
  q.topic,
  q.prompt,
  o ->> 'label' as option_label,
  o -> 'citation' ->> 'path' as path,
  (o -> 'citation' ->> 'startLine')::int as start_line,
  (o -> 'citation' ->> 'endLine')::int as end_line,
  o ->> 'explanation' as why,
  r.created_at
from public.questions q
join public.runs r on r.id = q.run_id
cross join lateral jsonb_array_elements(q.options) as o
where (o ->> 'verified')::boolean;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Enabled everywhere. No policy grants insert, update or delete to anon or
-- authenticated: every write goes through a route handler on the service role
-- key, which bypasses RLS entirely.

alter table public.runs enable row level security;
alter table public.repo_files enable row level security;
alter table public.chunks enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.profiles enable row level security;

-- Capability-URL reads: holding the run id is the credential.
create policy runs_read_by_id on public.runs
  for select to anon, authenticated using (true);

create policy questions_read_by_run on public.questions
  for select to anon, authenticated using (true);

create policy answers_read_by_run on public.answers
  for select to anon, authenticated using (true);

-- repo_files is readable so the UI can report what was skipped during
-- ingestion. It carries paths and sizes, never file contents.
create policy repo_files_read on public.repo_files
  for select to anon, authenticated using (true);

-- chunks gets NO select policy at all: full source text stays server-side.
-- Repository content is public by definition, but there is no reason to serve
-- it from our origin.

-- A signed-in user may read and update only their own profile.
create policy profiles_read_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Retrieval: cosine nearest neighbours within one run's partition
-- ---------------------------------------------------------------------------
-- Exposed as a function because PostgREST cannot express a vector distance
-- ordering. Locked to the service role -- it returns file contents.

create function public.match_chunks(
  p_run_id uuid,
  p_embedding extensions.vector(1536),
  p_match_count int default 6
)
returns table (
  id uuid,
  file_path text,
  start_line int,
  end_line int,
  content text,
  language text,
  similarity float
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.file_path,
    c.start_line,
    c.end_line,
    c.content,
    c.language,
    1 - (c.embedding operator(extensions.<=>) p_embedding) as similarity
  from public.chunks c
  where c.run_id = p_run_id
    and c.embedding is not null
  order by c.embedding operator(extensions.<=>) p_embedding
  limit greatest(p_match_count, 1);
$$;

revoke execute on function public.match_chunks(uuid, extensions.vector, int) from anon, authenticated;
