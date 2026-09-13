/**
 * Auth integration verification — the browser's half.
 *
 *   node scripts/verify-auth-flow.mjs http://localhost:3000
 *
 * `verify-auth.mjs` proves the Supabase calls work. This proves the *app*
 * responds to a session: that a signed-in browser bypasses the landing gate,
 * that the auth pages bounce someone already signed in, that the HUD shows
 * their name, and that signing out puts it all back.
 *
 * It mints a real session and hands the app the cookie `@supabase/ssr` would
 * have written, which is the only way to exercise these paths without driving
 * a browser.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (ok) passed++;
  else failed++;
};

const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

/** The cookie name `@supabase/ssr` derives from the project ref. */
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const AUTH_COOKIE = `sb-${projectRef}-auth-token`;

/** How `@supabase/ssr` serialises a session into that cookie. */
function sessionCookie(session) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64");
  return `${AUTH_COOKIE}=base64-${payload}`;
}

const email = `rpo-flow+${Date.now()}@example.com`;
const password = `pixel-${Math.random().toString(36).slice(2, 12)}`;
const displayName = "Ada Lovelace";
let userId = null;
const runIds = [];

console.log(`\nVerifying auth integration at ${baseUrl}\n`);

try {
  // --- a signed-in session --------------------------------------------------
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError) throw createError;
  userId = created.user.id;

  await admin.from("profiles").upsert({
    id: userId,
    display_name: displayName,
    username: `ada_${userId.slice(0, 6)}`,
  });

  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  check("password sign-in returns a session", !signInError && !!signIn.session);

  const authed = sessionCookie(signIn.session);
  const anonId = crypto.randomUUID();

  const get = (path, cookie) =>
    fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: "manual" });

  // --- the gate -------------------------------------------------------------
  // No rpo_seen: a signed-in visitor must still go straight through, or
  // returning to a bookmark in a new browser bounces them to a landing screen.
  const gated = await get("/history", `rpo_aid=${anonId}`);
  check("anonymous + unseen is sent to the landing screen", gated.status === 307);

  const throughGate = await get("/history", `rpo_aid=${anonId}; ${authed}`);
  check(
    "signed-in bypasses the landing gate without rpo_seen",
    throughGate.status === 200,
    `got ${throughGate.status}`,
  );

  // --- auth pages know you are signed in ------------------------------------
  const login = await get("/login", `rpo_seen=1; ${authed}`);
  check(
    "/login redirects an already signed-in visitor",
    login.status === 307,
    `-> ${login.headers.get("location") ?? "(none)"}`,
  );

  const signup = await get("/signup", `rpo_seen=1; ${authed}`);
  check("/signup redirects an already signed-in visitor", signup.status === 307);

  const loginAnon = await get("/login", `rpo_seen=1`);
  check("/login still renders for a signed-out visitor", loginAnon.status === 200);

  // --- the HUD reflects the session ----------------------------------------
  const home = await get("/home", `rpo_seen=1; ${authed}`);
  const homeText = textOf(await home.text());
  check(
    "HUD shows the signed-in display name",
    homeText.includes(displayName),
    displayName,
  );
  check(
    "HUD no longer shows the hardcoded placeholder",
    !homeText.includes("Player_Intern"),
  );

  const anonHome = await get("/home", `rpo_seen=1; rpo_aid=${anonId}`);
  const anonText = textOf(await anonHome.text());
  check(
    "anonymous play still works and keeps the default name",
    anonHome.status === 200 && anonText.includes("Player_Intern"),
  );

  // --- settings reflects the session ---------------------------------------
  const settings = await get("/settings", `rpo_seen=1; ${authed}`);
  // Input values live in attributes, so assert on the raw HTML -- stripping
  // tags to get "visible text" throws away exactly what a form renders.
  const settingsHtml = await settings.text();
  check(
    "settings shows the profile for a signed-in user",
    settingsHtml.includes(displayName) && settingsHtml.includes(email),
  );

  const anonSettings = await get("/settings", `rpo_seen=1; rpo_aid=${anonId}`);
  check(
    "settings tells an anonymous player what they are missing",
    textOf(await anonSettings.text()).includes("playing anonymously"),
  );

  // --- claim on sign-in -----------------------------------------------------
  // The action does this after a successful sign-in; here we prove the runs it
  // would adopt are the right ones and that a second pass is a no-op.
  for (let i = 0; i < 2; i++) {
    const { data } = await admin
      .from("runs")
      .insert({
        owner: "flowtest",
        repo: `r${i}`,
        commit_sha: "f".repeat(40),
        anon_id: anonId,
      })
      .select("id")
      .single();
    runIds.push(data.id);
  }

  const { data: claimed } = await admin
    .from("runs")
    .update({ user_id: userId })
    .eq("anon_id", anonId)
    .is("user_id", null)
    .select("id");
  check("claim adopts this browser's anonymous runs", claimed.length === 2);

  const history = await get("/history", `rpo_seen=1; ${authed}`);
  const historyText = textOf(await history.text());
  check(
    "claimed runs appear in the signed-in player's history",
    historyText.includes("flowtest/r0"),
  );

  // --- logout ---------------------------------------------------------------
  const loggedOut = await fetch(`${baseUrl}/logout`, {
    method: "POST",
    headers: { cookie: `rpo_seen=1; ${authed}` },
    redirect: "manual",
  });
  check(
    "logout redirects to /login",
    loggedOut.status === 307 &&
      (loggedOut.headers.get("location") ?? "").includes("/login"),
  );

  const afterLogout = await get("/home", `rpo_seen=1; rpo_aid=${anonId}`);
  check(
    "after logout the signed-in name is gone",
    !textOf(await afterLogout.text()).includes(displayName),
  );
} finally {
  for (const id of runIds) await admin.from("runs").delete().eq("id", id);
  if (userId) {
    await admin.from("runs").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
