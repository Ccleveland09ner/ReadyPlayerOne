-- Actually revoke match_chunks() from the browser roles.
--
-- The first migration did:
--
--   revoke execute on function public.match_chunks(...) from anon, authenticated;
--
-- which reads as a lockdown but is not one. PostgreSQL grants EXECUTE on every
-- new function to PUBLIC by default, and revoking from two specific roles
-- leaves the PUBLIC grant untouched -- so anon could still call it. Verified
-- against the live project: the call succeeded.
--
-- It returned no rows, because the function is `security invoker` and RLS on
-- `chunks` denies anon. So nothing leaked. But that means the only thing
-- standing between a browser and the full source text of every ingested
-- repository was one `security invoker` keyword. If anyone ever switches it to
-- `security definer` -- the natural thing to try when retrieval "mysteriously
-- returns nothing" -- it leaks immediately and silently.
--
-- Defense in depth: take the PUBLIC grant away and hand EXECUTE only to the
-- service role, which is the only caller that should ever have it.

revoke execute on function public.match_chunks(uuid, extensions.vector, int) from public;
revoke execute on function public.match_chunks(uuid, extensions.vector, int) from anon, authenticated;

grant execute on function public.match_chunks(uuid, extensions.vector, int) to service_role;

-- Same reasoning for anything added later: new functions in this schema should
-- not be callable by the browser roles unless that is a deliberate decision.
alter default privileges in schema public revoke execute on functions from public;
