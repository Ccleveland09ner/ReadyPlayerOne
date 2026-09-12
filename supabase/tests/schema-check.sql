-- Schema integrity check for the ReadyPlayerOne migration.
--
-- Run this after applying migrations, against a local stack or a linked
-- project, to confirm the schema is shaped the way the pipeline assumes:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/schema-check.sql
--
-- Every check RAISEs on failure, so a non-zero exit means something is wrong.
-- Behavioural tests (cache key, match_chunks ordering, RLS enforcement) live
-- in schema-behaviour.sql; this file only asserts structure.

\set ON_ERROR_STOP on
\timing off

do $$
declare
  missing text;
begin
  -- ---- extension -----------------------------------------------------------
  if not exists (select 1 from pg_extension where extname = 'vector') then
    raise exception 'FAIL: the vector extension is not installed';
  end if;

  -- ---- the template demo table is gone -------------------------------------
  if to_regclass('public.todos') is not null then
    raise exception 'FAIL: public.todos still exists; its permissive policies must not ship';
  end if;

  -- ---- six tables ----------------------------------------------------------
  select string_agg(t, ', ') into missing
  from unnest(array['runs','repo_files','chunks','questions','answers','profiles']) as t
  where to_regclass('public.' || t) is null;

  if missing is not null then
    raise exception 'FAIL: missing tables: %', missing;
  end if;

  -- ---- the view ------------------------------------------------------------
  if not exists (
    select 1 from pg_views where schemaname = 'public' and viewname = 'verified_citations'
  ) then
    raise exception 'FAIL: verified_citations view is missing';
  end if;

  -- ---- embedding column is the dimension the code asserts ------------------
  if not exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'chunks' and a.attname = 'embedding'
      and format_type(a.atttypid, a.atttypmod) like 'vector(1536)%'
  ) then
    raise exception 'FAIL: chunks.embedding is not vector(1536)';
  end if;

  -- ---- the snapshot cache key ----------------------------------------------
  -- Partial, so only runs that own their chunks and reached a usable state
  -- can be reused. A plain unique index here would block retakes entirely.
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'runs_snapshot_cache_key'
      and indexdef like '%UNIQUE%'
      and indexdef like '%snapshot_run_id IS NULL%'
      and indexdef like '%ready%'
  ) then
    raise exception 'FAIL: runs_snapshot_cache_key is missing or is not the expected partial unique index';
  end if;

  -- ---- history / HUD indexes ------------------------------------------------
  select string_agg(i, ', ') into missing
  from unnest(array['runs_anon_id_created_at','runs_user_id_created_at',
                    'chunks_run_id','chunks_run_id_file_path']) as i
  where not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = i
  );

  if missing is not null then
    raise exception 'FAIL: missing indexes: %', missing;
  end if;

  -- ---- uniqueness the pipeline relies on for idempotency -------------------
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.answers'::regclass and contype = 'u'
      and array_length(conkey, 1) = 2
  ) then
    raise exception 'FAIL: answers is missing its (run_id, question_id) unique constraint';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.questions'::regclass and contype = 'u'
      and array_length(conkey, 1) = 2
  ) then
    raise exception 'FAIL: questions is missing its (run_id, order_index) unique constraint';
  end if;

  -- ---- guards that keep bad data out of citations --------------------------
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.chunks'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%start_line%'
  ) then
    raise exception 'FAIL: chunks is missing its line-range check constraint';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.questions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%jsonb_array_length%'
  ) then
    raise exception 'FAIL: questions is missing its four-options check constraint';
  end if;

  -- ---- RLS on every table --------------------------------------------------
  select string_agg(c.relname, ', ') into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('runs','repo_files','chunks','questions','answers','profiles')
    and c.relrowsecurity = false;

  if missing is not null then
    raise exception 'FAIL: RLS is not enabled on: %', missing;
  end if;

  -- ---- chunks must have NO read policy -------------------------------------
  -- It holds full source text. Repository content is public by definition, but
  -- there is no reason to serve it from our origin.
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chunks') then
    raise exception 'FAIL: chunks has a policy; it must not be readable by anon or authenticated';
  end if;

  -- ---- nobody but the service role may write -------------------------------
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE')
      and 'anon' = any(roles)
  ) then
    raise exception 'FAIL: a write policy grants the anon role access; all writes go through the service key';
  end if;

  -- ---- match_chunks exists and is not callable by the browser roles --------
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'match_chunks'
  ) then
    raise exception 'FAIL: match_chunks() is missing';
  end if;

  if has_function_privilege('anon', 'public.match_chunks(uuid, extensions.vector, int)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute match_chunks(); it returns file contents';
  end if;

  if has_function_privilege('authenticated', 'public.match_chunks(uuid, extensions.vector, int)', 'EXECUTE') then
    raise exception 'FAIL: authenticated can execute match_chunks(); it returns file contents';
  end if;

  raise notice 'PASS: schema integrity checks all passed';
end
$$;
