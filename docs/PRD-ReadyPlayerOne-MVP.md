# Product Requirements Document: ReadyPlayerOne MVP

## Executive Summary

**Product:** ReadyPlayerOne
**Version:** MVP (1.0)
**Document Status:** Draft — ready for Technical Design
**Last Updated:** September 11, 2026

### Product Vision

Point ReadyPlayerOne at any public GitHub repository and it turns that codebase into a five-question quiz — the questions a new hire should be able to answer after day one. Every answer choice comes with an explanation bound to a verified file-and-line citation in the actual source, so what you're told is checkable rather than merely plausible. Hearts, streaks, XP, and mastery ranks accumulate across every repo you take on.

The framing is deliberate: the theme is academia versus industry, and the gap is that school grades code you wrote while industry grades code you read. A game about reading someone else's codebase makes that argument before anyone reads a word of the description.

School teaches you to write code from scratch. Industry hands you 200,000 lines someone else wrote and expects you to be useful in it. ReadyPlayerOne turns "read the repo until you feel okay" into a measurable, cited, repeatable exercise.

### Success Criteria

- A judge pastes an unfamiliar public repo URL during the demo and reaches a scored Quiz Complete screen end to end in under 3 minutes.
- Every citation shown resolves to real lines in the exact commit that was ingested — zero fabricated file paths or line ranges.
- The full demo (splash → paste URL → quiz → results → answer review) records in one continuous screen capture under the 3-minute video cutoff.
- The retro-arcade treatment in the mockups survives implementation. The look is a scored asset, not decoration.

## Problem Statement

### Problem Definition

Onboarding onto an unfamiliar codebase is the single most common industry task that academia never assigns. A CS degree grades you on code you wrote yesterday; a job grades you on code a stranger wrote three years ago. The gap shows up in concrete ways:

- New engineers spend their first days reading without any signal for whether they're reading the right things or understanding them correctly.
- README files describe intent, not structure. They go stale, and they never state the unwritten conventions.
- Self-assessment is unreliable. Skimming a repo produces a feeling of comprehension that collapses the first time someone asks "where would you change this?"
- Existing AI tools answer questions *about* a repo. That's a crutch — it replaces the comprehension instead of measuring it. Nothing tests you.

The mentor who would normally close this gap — a senior engineer with time to quiz you — is the scarcest resource on any team.

### Impact Analysis

- **User impact:** Students and early-career engineers get a concrete, gradeable onboarding target instead of an open-ended reading assignment, and a specific list of what they misunderstood with the source to prove it.
- **Market impact:** Assumption, not measured — every team that onboards engineers has this problem, but we have no sizing data and are not claiming any.
- **Business impact:** Out of scope for a 24-hour hackathon MVP. No monetization is being built or modeled.

## Target Audience

### Primary Persona: The Incoming Intern

**Demographics:**
- Undergraduate CS student or bootcamp grad, ages 19–24
- Has an internship or first job starting soon, or is preparing for one
- Comfortable with Git, one or two languages, and their own projects

**Psychographics:**
- Confident writing code, anxious about reading it
- Motivated by scores and concrete feedback; discouraged by vague advice like "just read the codebase"
- Already uses AI assistants daily and is aware that leaning on them hides gaps

**Jobs to Be Done:**
1. Functional — find out whether I actually understand this codebase before someone asks me in standup.
2. Emotional — replace "I hope I get it" with a number and a list of what I missed.
3. Social — walk into day one able to ask informed questions instead of obvious ones.

**Current Solutions & Pain Points:**

| Current Solution | Pain Points | Our Advantage |
|-----------------|-------------|---------------|
| Reading the README and skimming files | No feedback loop; comprehension is self-reported and usually overestimated | Scored answers with the source that proves the score |
| Asking an AI chatbot about the repo | Answers *for* you; you learn nothing and can't tell what you missed | Asks *you*; AI is the examiner, not the substitute |
| Asking a senior engineer to quiz you | Their time is the scarcest resource on the team | Available instantly on any public repo |
| Generic onboarding checklists | Not specific to this repository; generic questions get generic answers | Questions generated from this repo's actual structure and conventions |

### Secondary Personas

- **Open-source maintainer** — wants a repeatable comprehension check for first-time contributors instead of answering the same orientation questions in every issue thread.
- **Team lead onboarding a new hire** — wants a same-day signal on where the new engineer's mental model is wrong, before they open a PR.

## User Stories

### Epic: Prove You Understand an Unfamiliar Codebase

**Primary User Story:**
"As an incoming intern, I want to be quizzed on the repository I'm about to work in and graded against its actual source, so that I know what I misunderstood before my first standup."

**Acceptance Criteria:**
- [ ] User submits a public GitHub URL and reaches a generated quiz without any account, configuration, or local setup.
- [ ] Questions reference real elements of the repository (real file paths, real modules, real conventions), not generic software trivia.
- [ ] Each graded answer includes at least one citation that resolves to a file path and line range in the ingested commit.
- [ ] The final report gives a per-category readiness breakdown, not just one number.

### Supporting User Stories

1. "As a player, I want to see progress while the repo is being read, so that I don't think the app is broken during the wait."
   - AC: A staged progress indicator reports fetching → indexing → generating with file counts; the screen never sits without feedback for more than 5 seconds.
2. "As a player, I want to know why my answer was wrong, backed by the actual file, so that I learn instead of just losing a point."
   - AC: Every question's review shows why the correct option is correct and why the chosen option isn't, each carrying a `path:start–end` citation linking to a GitHub permalink at the ingested commit.
3. "As a player, I want hearts and a streak while I answer, so that the quiz has stakes and momentum."
   - AC: Three hearts, one lost per wrong answer; a streak counter that increments on correct answers and resets on wrong ones; both visible on every question screen.
4. "As a player, I want a score and a mastery rank at the end, so that I know where I stand on this codebase."
   - AC: Quiz Complete shows score as `n/5` and a percentage, a named mastery tier, a per-question correct/wrong breakdown, and which topics were covered and passed.
5. "As a returning player, I want a history of every quiz I've taken, so that I can re-open an old result or resume an unfinished one."
   - AC: A paginated table lists runs newest-first with repository, date, score, and mastery, each opening the right destination for its state.
6. "As a returning player, I want a report across all my quizzes, so that I can see whether I'm actually improving and what I'm weak at."
   - AC: The Report screen shows total quizzes, average score, best score, a score trend over time, per-topic accuracy bars, recent activity, and plain-language insights derived from those numbers.
7. "As a player, I want to retake a quiz on the same repo, so that I can prove the reading I did between attempts worked."
   - AC: Try Again creates a new run against the cached snapshot and both attempts remain in History.
8. "As a player, I want an account, so that my progress follows me off this browser."
   - AC: Email and password sign-up and log-in; runs made anonymously in that browser are claimed on first sign-in.

## Functional Requirements

### Core Features (MVP — P0)

#### Feature 1: Repository Ingestion & Snapshot

- **Description:** Accept a public GitHub repository URL, resolve it to a specific commit SHA, fetch the file tree, filter to meaningful source files under a hard size budget, and store an immutable snapshot of that ingestion.
- **User Value:** One paste, zero setup — no cloning, no tokens, no local environment.
- **Business Value:** Pinning to a commit SHA is what makes every downstream citation verifiable and what makes repeat runs cacheable.
- **Acceptance Criteria:**
  - [ ] Accepts `https://github.com/owner/repo` and `owner/repo` forms; rejects private, nonexistent, and non-GitHub URLs with a specific error message.
  - [ ] Resolves and stores the default branch's HEAD commit SHA for the run.
  - [ ] Excludes lockfiles, binaries, minified bundles, `node_modules`, build output, and vendored directories.
  - [ ] Enforces hard caps on file count and total bytes and reports what was skipped.
  - [ ] A repeat request for the same owner/repo/SHA reuses the existing snapshot instead of re-ingesting.
- **Dependencies:** GitHub REST API availability and rate limits.
- **Estimated Effort:** M (~3 hours)

#### Feature 2: Repo Map & Retrieval Index

- **Description:** Build a structural digest of the snapshot (directory tree, detected stack, entry points, dependency list) and a line-aware chunk index with embeddings stored in Postgres via pgvector.
- **User Value:** Both the questions and the grading are grounded in the repository's real structure rather than in a model's guess about what a project like this usually looks like.
- **Business Value:** This is the substantive technical layer — retrieval over code with preserved line numbers is what makes citations possible at all.
- **Acceptance Criteria:**
  - [ ] Every chunk stores file path, start line, and end line, and those numbers match the source file exactly.
  - [ ] Chunks are embedded and retrievable by vector similarity, filtered to the current run.
  - [ ] The repo map identifies at least: directory structure, primary language, declared dependencies, and candidate entry points.
  - [ ] Indexing of a capped repository completes within the ingestion budget defined in Non-Functional Requirements.
- **Dependencies:** Feature 1; pgvector extension enabled in Supabase.
- **Estimated Effort:** L (~3.5 hours)

#### Feature 3: Quiz Generation

- **Description:** Generate a five-question multiple-choice quiz from the snapshot, spread across five topics — File Structure, Core Logic, APIs, Testing, Deployment. Each question carries four options, exactly one correct, and a short explanation per option, each explanation bound to the chunk that justifies it.
- **User Value:** The questions are the ones a real lead would ask about this codebase, and every explanation points at the file that proves it.
- **Business Value:** Multiple choice is what makes the rest of the system cheap and reliable — scoring becomes deterministic, grading needs no model call, and per-question latency drops to zero. All the citation rigor moves into generation, where it's checked once rather than per answer.
- **Acceptance Criteria:**
  - [ ] Five questions, one per topic, each with four options and exactly one correct answer.
  - [ ] Distractors are plausible and repo-specific — real directories, real modules, real tools from this project, not invented names.
  - [ ] Each option stores an explanation and the chunk id supporting it; the correct option's citation must survive verification or the question is regenerated.
  - [ ] Questions are answerable from the ingested snapshot alone.
  - [ ] Generation fails loudly rather than emitting generic filler when the repo is too small or unreadable.
- **Dependencies:** Features 1 and 2.
- **Estimated Effort:** L (~4 hours — distractor quality is where the time goes)

#### Feature 4: Quiz Play

- **Description:** One question per screen inside the game shell: three hearts, a streak counter, an XP bar, level name, per-question progress, and the repo selector in the top bar. Selecting an option advances to the next question.
- **User Value:** Stakes and momentum. A quiz with hearts and a streak gets finished; a form does not.
- **Business Value:** This is the screen the demo spends the most time on, so it carries the whole aesthetic argument.
- **Acceptance Criteria:**
  - [ ] Shows question `n of 5`, topic/level name, four selectable options, and a Next Question control.
  - [ ] Three hearts; a wrong answer costs one. At zero hearts the run ends early and reports on what was answered.
  - [ ] Streak increments on correct answers and resets to zero on a wrong one, visible in the right rail.
  - [ ] Answers persist server-side on selection, so a refresh resumes at the right question with hearts and streak intact.
  - [ ] Correct/incorrect feedback on the option is shown before advancing.
- **Dependencies:** Feature 3.
- **Estimated Effort:** L (~4 hours including the shell and HUD)

#### Feature 5: Scoring & Citation Verification

- **Description:** Score each answer by comparing the selected option to the stored correct index — no model call — then verify every citation attached to the shown explanations against the snapshot before display.
- **User Value:** Instant results, and explanations you can check rather than trust.
- **Business Value:** This is the differentiator and the reliability story at once. Deterministic scoring removes the single most likely demo failure (a grading call timing out mid-quiz), and mechanical citation verification means a model cannot fabricate evidence even if it fabricates prose.
- **Acceptance Criteria:**
  - [ ] Scoring is exact and instant; no network call is required to score an answer.
  - [ ] Every displayed citation names a file path and line range that exists in the ingested snapshot.
  - [ ] Citations failing verification are discarded at generation time and counted per run; a question whose correct option has no surviving citation is regenerated, not shipped.
  - [ ] Citations link to GitHub permalinks pinned to the ingested commit SHA.
- **Dependencies:** Features 2 and 3.
- **Estimated Effort:** M (~2.5 hours)

#### Feature 6: Quiz Complete

- **Description:** The results screen: score as `n/5` and a percentage, a named Codebase Mastery tier with a segmented bar, a per-question correct/wrong breakdown, the topics covered with pass marks, and three actions — View Answers, Try Again, Back Home.
- **User Value:** Turns five answers into a standing on this codebase.
- **Business Value:** This is the frame the demo video ends on.
- **Acceptance Criteria:**
  - [ ] Mastery tiers by percentage: Codebase Master (100%), Well Knowledgeable (80–99%), Getting There (60–79%), Keep Practicing (below 60%).
  - [ ] Question breakdown shows every question as correct or wrong at a glance.
  - [ ] Topics Covered lists all five topics with a pass or fail mark.
  - [ ] Try Again starts a fresh run against the cached snapshot; Back Home returns to repo entry.
- **Dependencies:** Feature 5.
- **Estimated Effort:** M (~2 hours)

#### Feature 7: Answer Review

- **Description:** The screen behind View Answers: each question with the option chosen, the correct option, why each is right or wrong, and the verified citations for both.
- **User Value:** The actual learning happens here — this is where a wrong answer turns into knowing which file to read.
- **Business Value:** This is where the citation work becomes visible. Without this screen the verification pipeline is invisible to judges.
- **Acceptance Criteria:**
  - [ ] Every question shows chosen option, correct option, and both explanations.
  - [ ] Every citation renders as `path:start–end` and links to the pinned GitHub permalink.
  - [ ] A question with no surviving citation is labeled low-confidence rather than presented as authoritative.
- **Dependencies:** Feature 5.
- **Estimated Effort:** S (~1.5 hours)

#### Feature 8: Quiz History

- **Description:** A paginated table of every run for this player — rank number, repository, date and time, score, mastery tier, and a View Results action — with a total-quizzes counter and a trophy marker on the best run.
- **User Value:** The product stops being a one-shot toy. Old results stay reachable and unfinished quizzes can be resumed.
- **Business Value:** Return visits, and the screen that makes accumulated progression legible.
- **Identity model:** an `anon_id` issued on first visit and stored in a first-party cookie. History works with no account; signing in claims every run carrying that `anon_id`.
- **Acceptance Criteria:**
  - [ ] Paginated at 10 rows per page, newest first, with working next/previous controls and a page indicator.
  - [ ] A finished run opens Quiz Complete; an unfinished one resumes at the first unanswered question.
  - [ ] Empty state explains what will appear there rather than showing a blank table.
  - [ ] Signing in claims prior anonymous runs from that browser.
- **Dependencies:** Features 1–6.
- **Estimated Effort:** M (~2.5 hours)

#### Feature 9: Progression (Derived, Not Stored)

- **Description:** Level, XP, and mastery computed from existing answer rows rather than maintained as separate state: 10 XP per correct answer, 25 for finishing a quiz, 100 XP per level, level names by tier ("Level 1: Getting Oriented").
- **User Value:** The HUD in every mockup needs real numbers behind it.
- **Business Value:** Deriving progression from answers costs one SQL query and zero new tables, and it can never drift out of sync with the underlying results.
- **Acceptance Criteria:**
  - [ ] Level, XP, and the XP bar render on every screen with the shell.
  - [ ] In-run streak comes from the current run's answers in order.
  - [ ] The numbers are recomputed, never incremented — deleting a run corrects the totals automatically.
- **Dependencies:** Feature 5.
- **Estimated Effort:** S (~1 hour)

### Should Have (P1)

These are in the mockups and belong in the product. They are not on the demo's critical path, so they get built only after every P0 above works end to end.

- **Reports dashboard (`/report`)** — total quizzes, average score, best score, strong-area count, score trend over time, per-topic accuracy bars, recent activity list, and plain-language insights. **The insights are template strings computed from the stats, not a model call** — deterministic, instant, free. Needs a repository filter and at least four prior runs to look like the mockup, so seed demo data before recording.
- **Accounts** — Create Profile (full name, email, password) and Log In, matching the synthwave mockups. Replaces the starter template's email-OTP flow with Supabase password auth, and claims anonymous runs on first sign-in.
- **Splash screen** — the "click to continue" title card. Cheap, and it sets the tone in the first two seconds of the demo video.
- **Settings — Quiz Preferences and Profile** — question count, difficulty, include explanations, show code snippets; username, display name, email.
- **Ingestion progress detail** — staged counts rather than a single spinner.
- **Pre-seeded demo repositories** — 2–3 pre-ingested repos in the top-bar dropdown for instant starts and as a stage fallback.

### Could Have (P2)

- **Settings — Appearance** — theme (Dark / Light / Retro) and accent color. Three themes is three times the styling QA; Dark is the only one the demo needs.
- **Settings — Data & Privacy and Account** — clear history, export JSON, change password, delete account.
- **Time limit per question** — adds a timer, a timeout state, and a whole class of race conditions to the answer path.
- **Hints** — the "Need a hint?" affordance, revealing the grounding file path without the answer.
- **Cross-run day streak** — distinct from the in-run answer streak and requires stored state.
- **Free-text hard mode** — the original design's model-graded written answers, as an opt-in difficulty above multiple choice.
- **Answer-time hints** — reveal the grounding file path without revealing the answer.
- **Report export** — Markdown download of the graded report.

## Out of Scope (Not in MVP)

- **Private repository support (GitHub OAuth):** Adds an OAuth app, token storage, and a security surface we cannot responsibly build in 24 hours. Public repos fully demonstrate the concept.
- **Non-GitHub hosts (GitLab, Bitbucket, raw uploads):** One ingestion path, done well, beats three half-working ones.
- **Deep AST or call-graph analysis:** High cost, high risk of being unfinished at hour 23. Line-aware chunking plus retrieval delivers the same demo value.
- **Whole-repo ingestion without caps:** Unbounded cost and latency; the caps are a feature, not a limitation to remove later.
- **Team dashboards, leaderboards, cross-player comparison:** The Report screen aggregates one player's own runs; comparing players needs social features, moderation, and an audience we don't have.
- **Native mobile app:** Responsive web covers every judging and usage scenario.
- **Multi-turn Socratic follow-up questioning:** Doubles the question surface and the demo runtime.
- **Multiple quiz types:** The start panel shows a Quiz Type field; "Code Understanding" is the only type that exists. The field displays a constant until there's a second type worth building.

## Non-Functional Requirements

All figures below are targets we are setting for ourselves, not measured benchmarks.

### Performance

- **Ingestion + indexing:** ≤ 90 seconds for a repository within the size caps, with visible progress throughout.
- **Question generation:** ≤ 20 seconds after indexing completes.
- **Per-answer grading:** under 500ms. Scoring is a local comparison against the stored correct index — no model call sits between two questions.
- **Cached run start:** ≤ 3 seconds when the same owner/repo/SHA was already ingested.
- **Page interaction:** all navigation and answer submission responsive under 500ms excluding model calls.
- **Concurrency:** correct behavior for ~20 simultaneous runs (judging-day scale). Not designed beyond that.

### Security

- **Authentication:** Anonymous by default; optional email and password sign-up via Supabase Auth (P1) for saving runs across browsers. The starter template's email-OTP flow is replaced when accounts are built.
- **Authorization:** Run access is by unguessable UUID. All writes go through server-side route handlers using the service role key; browser clients never write to run tables directly.
- **Secrets:** Model provider keys and the Supabase service role key exist only as server environment variables, never in client bundles, never committed.
- **Untrusted input:** Repository content is untrusted text. It is delivered to models inside clearly delimited data regions, and any instruction-like content inside a repo must not alter grading behavior.
- **Compliance:** None applicable. Public repository content only; no PII collected beyond an optional email address.

### Usability

- **Accessibility:** Keyboard-navigable quiz flow, labeled form controls, WCAG 2.1 AA contrast on all text.
- **Browser support:** Latest two versions of Chrome, Safari, Firefox, Edge.
- **Mobile support:** Responsive down to 375px; the quiz and report are readable and usable on a phone.
- **Internationalization:** English only.

### Scalability

- **User growth:** Not a 24-hour concern. The architecture must not fall over during judging; it does not need to survive a launch.
- **Data growth:** Bounded by per-run caps. Snapshot reuse by commit SHA keeps storage and embedding spend sublinear in repeat traffic.
- **Geographic distribution:** Single region.

## Quality Standards

*Engineering quality standards (type safety, testing, code rules) are defined later in AGENTS.md (Part 4), not in this document. The starter repository already ships an `AGENTS.md` and `CLAUDE.md`; extend those rather than creating new ones.*

## UI/UX Requirements

The ten mockups are the spec for this section. Where they and the earlier text disagreed, the mockups win.

### Design Principles

1. **It reads as a game, not a dashboard.** Pixel-art panels, a bedroom scene behind everything, a player HUD. The retro-arcade treatment is a judged asset — the theme is "academia vs industry", and a game about learning a codebase makes that argument visually before anyone reads a word.
2. **Evidence is always one click away.** Every scored answer carries a verified `path:start–end` citation. Game feel never replaces the receipts; the explanation panel is where the two meet.
3. **The wait is narrated.** Ingestion is the longest moment in the product; it shows what it's doing rather than spinning.
4. **Nothing you did disappears.** Every run, answer, and citation stays reachable from the left nav. Progression comes from accumulation — score, streak, XP, mastery tiers — not from confetti.

### Art Direction

- **Palette:** deep indigo background (`#1a1440`-class), lighter purple panels with a glowing blue border and pixel corner rivets, neon yellow for primary CTAs, green for correct/success, red for wrong/destructive, magenta and cyan reserved for the splash and auth screens.
- **Type:** a pixel display face for headings and HUD numbers, a monospace face for body text, code, and citations. Two faces total.
- **Panel treatment:** every screen is one framed CRT-style panel floating over the room. Quiz and home panels are light-on-dark inverted (white panel, dark text) for readability during the demo; History, Report, and Settings are dark panels.
- **The room is one image, not DOM.** Export the bedroom scene as a single static background asset and build every interactive element as HTML/CSS on top. Rebuilding the shelves, posters, and cat in markup is a day of work that no judge will award a point for.
- **Mobile:** the room scene does not survive 375px. Below the `md` breakpoint, drop the background to a flat gradient, move the left nav to a bottom bar, and collapse the HUD to score plus hearts.
- **Accessibility warning:** pixel fonts at small sizes and neon-on-dark both fail contrast easily. Body copy stays monospace at a normal size, and every color pairing gets checked at AA before the styling pass is called done. The look is worth points; an unreadable screen on a projector costs more.

### Layout Shell

Present on every screen except splash and auth:

- **Left rail:** logo and tagline, then Home / History / Quiz / Report / Settings, active item highlighted.
- **Top bar:** repository selector on the left (current repo, dropdown of previously used repos, "Select a repository…" when none), player card on the right (avatar, username, level, XP bar during a quiz).
- **Right rail (quiz only):** Your Progress panel (level name and `n/5`), Current Streak panel (flame + count), and a motivational poster.

### Screen Inventory

| # | Screen | Route | Tier |
|---|---|---|---|
| 1 | Splash — "click to continue" | `/` (pre-auth) | P1 |
| 2 | Log In | `/login` | P1 |
| 3 | Create Profile | `/signup` | P1 |
| 4 | Home — repo entry, "Would you kindly…?" | `/` | P0 |
| 5 | Home — confirm and start ("Would you kindly… start?") | `/runs/:id/start` | P0 |
| 6 | Ingesting — staged progress | `/runs/:id` | P0 |
| 7 | Quiz — question, options, HUD | `/runs/:id/quiz` | P0 |
| 8 | Quiz Complete | `/runs/:id/complete` | P0 |
| 9 | Answer Review — explanations and citations | `/runs/:id/answers` | P0 |
| 10 | Quiz History | `/history` | P0 |
| 11 | Reports dashboard | `/report` | P1 |
| 12 | Settings | `/settings` | P1/P2 per section |

The ingesting screen (6) has no mockup. Build it in the same panel frame as the start screen, with the staged progress from Feature 1 — it is the only screen a judge waits on, so it cannot be an afterthought.

### Information Architecture

```
├── Splash → Log In / Create Profile
├── Home
│   ├── Repo entry (paste or pick from dropdown)
│   ├── Confirm and start (repo, quiz type, question count)
│   └── Ingesting (fetching → indexing → generating)
├── Quiz (question 1..5, HUD: hearts, streak, XP, progress)
│   ├── Quiz Complete (score, mastery, breakdown, topics)
│   └── Answer Review (per-question explanation + citations)
├── History (paginated run table → View Results)
├── Report (stats, score trend, per-topic bars, recent activity, insights)
└── Settings (profile, quiz preferences, appearance, data, account)
```

### Key User Flows

#### Flow 1: Cold Start to Quiz Complete (the demo path)

1. Splash → 2. Home, paste a public GitHub URL → 3. Confirm panel shows repo, quiz type, question count → 4. Ingestion runs with staged progress → 5. Decision: if the repo is private, oversized, or has too little source, show a specific error and return to step 2; otherwise continue → 6. Answer 5 questions, one per screen, with hearts and streak updating → 7. Quiz Complete with score and mastery tier.

#### Flow 2: Verify an Answer

1. From Quiz Complete, click View Answers → 2. Expand a question marked wrong → 3. Read why the correct option is correct and why the chosen one isn't → 4. Click the citation → 5. GitHub opens at the exact lines of the ingested commit.

#### Flow 3: Return and Resume

1. Open History from the left nav → 2. Page back to an earlier run → 3. Decision: a finished run opens its Quiz Complete screen; an unfinished one resumes at the first unanswered question.

#### Flow 4: Retake and Improve

1. From Quiz Complete, click Try Again → 2. A new run is created against the same cached snapshot, so it starts in seconds → 3. The new score appears in History and moves the Report's score trend.

#### Flow 5: Cached Repo Start

1. Pick a repo already ingested at the same commit from the top-bar dropdown → 2. Snapshot and questions are reused → 3. The quiz opens in under 3 seconds.
## Success Metrics

| Category | Metric | Target | Measurement |
|----------|--------|--------|-------------|
| Demo reliability | Cold-start runs completing end to end without error | 9 of 10 attempts on rehearsal repos | Manual rehearsal log before submission |
| Citation integrity | Displayed citations resolving to real lines in the ingested commit | 100% | Automatic verification pass; per-run counter of rejected citations |
| Grounding quality | Generated questions answerable from the snapshot alone, with repo-specific distractors | 5 of 5 on each rehearsal repo | Manual review against the source |
| Activation | Visitors who reach a graded report | ≥ 60% of runs started | `runs` table status counts |
| Engagement | Questions answered per started run | ≥ 4 of 5 | `answers` count per run |
| Performance | Ingestion within the 90-second target | ≥ 90% of capped repos | Timestamps recorded per run stage |
| Revenue | Not applicable for MVP | — | — |

## Constraints & Assumptions

### Constraints

- **Budget:** $0–$10 total. Free tiers throughout: Supabase free, Vercel Hobby, GitHub public API, free or trial-credit model access.
- **Timeline:** 24 hours, hard stop, including recording and submitting the demo video.
- **Resources:** Two-person team (the hackathon requires teams of 2–4; solo entries are not permitted).
- **Technical:** The build must sit on the provided starter repository — Next.js App Router, TypeScript, Tailwind, Supabase Postgres + Auth, deployed to Vercel. There is no separate Python service, so all pipeline work runs in Next.js route handlers under serverless execution limits.
- **Submission:** A 3-minute demo video with a hard cutoff, plus a written description.

### Assumptions

- Target repositories are public, GitHub-hosted, and predominantly text source files.
- Judges will test with a repository we have never seen, so quality cannot depend on repo-specific tuning.
- Retrieval over line-aware code chunks is sufficient grounding for both question generation and grading at day-one depth — no AST analysis needed.
- Free-tier model rate limits are adequate for demo-scale traffic; sustained public traffic is not expected within the judging window.

### Open Questions

- TBD — What is the actual judging rubric and its category weights? The linked rubric in the hackathon deck was unfilled; confirm before finalizing what to polish in the last four hours.
- TBD — Which track is this submitted to, and can we submit to only one? Track 03 (Unfamiliar Codebase) is the intended fit.
- TBD — Which model provider gets the primary slot given whatever free credits are available at build time?
- TBD — Which 2–3 repositories are pre-seeded as demo defaults, and do any of them belong to the judges or organizers?

### Dependencies

- GitHub REST API for tree, blob, and commit resolution (external; unauthenticated rate limits apply — a personal access token raises them).
- A hosted embedding model and a mini/flash/haiku-tier chat model (external).
- Supabase project with the `vector` extension enabled (external, free tier).
- Vercel deployment with environment variables configured (external, free tier).

## MVP Definition of Done

### Feature Complete
- [ ] All nine P0 features implemented and reachable from the landing page
- [ ] All P0 acceptance criteria met
- [ ] Both teammates have reviewed the other's merged work

### Quality Assurance
- [ ] End-to-end run succeeds on at least three repositories of different languages and sizes, with repo-specific distractors in every generated question
- [ ] Citation verification proven: an artificially malformed citation is rejected and never displayed
- [ ] Error states verified for private repo, invalid URL, oversized repo, and model-call failure
- [ ] History verified with more than one page of runs: pagination, resume-in-progress, and View Results all work
- [ ] Hearts, streak, XP, and level verified against hand-computed values after a known sequence of answers
- [ ] Every screen checked against its mockup side by side before the styling pass is called done
- [ ] Signing in claims prior anonymous runs from the same browser
- [ ] Quiz, results, and history verified on a 375px viewport with the mobile fallback shell
- [ ] Performance targets spot-checked against the Non-Functional Requirements

### Documentation
- [ ] README states setup, environment variables, and caps
- [ ] Devpost description written, including the citation-verification differentiator
- [ ] Demo script written and timed under 3 minutes

### Release Ready
- [ ] Deployed to Vercel with all environment variables set
- [ ] Demo repositories pre-ingested and warm
- [ ] Demo video recorded, under the cutoff, in one continuous take
- [ ] No secrets in the repository history

---
*PRD Version: 1.0*
*Next Review: after the hackathon rubric is confirmed*
*Owner: Chawana*
*Stakeholders: Chawana, Max Myers*

---
## Handoff Context
<!-- Machine-readable summary for the next workflow step. Do not delete; the next prompt in the workflow reads this block. -->
- Stage: prd
- App name: ReadyPlayerOne
- User level: B  (A = vibe coder, B = developer, C = in-between)
- Target platform: web (responsive)
- Budget: $0–$10, free tiers only
- Timeline: 24-hour hackathon, single build window
- Source files: PRD-ReadyPlayerOne-MVP.md
---
