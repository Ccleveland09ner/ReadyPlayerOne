/**
 * Auth pathway verification.
 *
 *   node scripts/verify-auth.mjs
 *
 * Exercises the account flow end to end against the live project: create a
 * user, sign in with a password, claim the runs that browser made while
 * anonymous, and confirm a signed-in user can only see their own profile.
 *
 * This is the path the pixel /login and /signup screens will call once they
 * are wired -- the server side of it is already here, and this proves it works
 * before any UI depends on it. Creates a throwaway user and deletes it.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const anon = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (ok) passed++;
  else failed++;
};

const email = `rpo-verify+${Date.now()}@example.com`;
const password = `pixel-${Math.random().toString(36).slice(2, 12)}`;
let userId = null;
const runIds = [];

console.log(`\nVerifying auth against ${env.NEXT_PUBLIC_SUPABASE_URL}\n`);

try {
  // 1. Sign up. /signup calls supabase.auth.signUp; the admin API is the same
  //    path without the email round trip.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  check("create a user", !createError, createError?.message ?? "");
  if (createError) throw createError;
  userId = created.user.id;

  // 2. Password sign-in -- what /login will call once wired.
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  check("sign in with password", !signInError && !!session.session, signInError?.message ?? "");

  // 3. Runs made anonymously by one browser.
  const anonId = crypto.randomUUID();
  for (let i = 0; i < 3; i++) {
    const { data } = await admin
      .from("runs")
      .insert({
        owner: "auth-verify",
        repo: `r${i}`,
        commit_sha: "c".repeat(40),
        anon_id: anonId,
      })
      .select("id")
      .single();
    runIds.push(data.id);
  }
  check("anonymous runs exist", runIds.length === 3);

  // 4. Claim on sign-in. Signing in must never appear to erase history.
  const { data: claimed } = await admin
    .from("runs")
    .update({ user_id: userId })
    .eq("anon_id", anonId)
    .is("user_id", null)
    .select("id");
  check("claim on sign-in adopts prior runs", claimed.length === 3, `claimed ${claimed.length}`);

  // 5. Idempotent -- the `is('user_id', null)` filter is what makes it safe to
  //    run on every sign-in.
  const { data: again } = await admin
    .from("runs")
    .update({ user_id: userId })
    .eq("anon_id", anonId)
    .is("user_id", null)
    .select("id");
  check("claiming twice is a no-op", again.length === 0, `second pass moved ${again.length}`);

  // 6. Profile row.
  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    username: `player_${Date.now().toString(36)}`,
    display_name: "Player_Intern",
  });
  check("create a profile", !profileError, profileError?.message ?? "");

  // 7. A signed-in user sees only their own profile.
  const authed = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
    },
  );
  const { data: allProfiles } = await authed.from("profiles").select("id");
  check(
    "profiles RLS scopes to the signed-in user",
    allProfiles?.length === 1 && allProfiles[0].id === userId,
    `saw ${allProfiles?.length ?? 0} rows`,
  );

  // 8. Deleting the user must not delete their runs -- user_id is ON DELETE
  //    SET NULL, so the history survives as anonymous rather than vanishing.
  await admin.auth.admin.deleteUser(userId);
  userId = null;
  const { data: survived } = await admin.from("runs").select("id, user_id").in("id", runIds);
  check(
    "deleting the user keeps their runs",
    survived.length === 3 && survived.every((r) => r.user_id === null),
    `${survived.length} runs, user_id nulled`,
  );
} finally {
  for (const id of runIds) await admin.from("runs").delete().eq("id", id);
  if (userId) await admin.auth.admin.deleteUser(userId);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
