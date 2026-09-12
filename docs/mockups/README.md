# UI Skeleton Reference Set

The ten reference screens for ReadyPlayerOne, and the source of truth for how
the app should look. The PRD says it plainly: **where these mockups and the
written specs disagree, the mockups win.**

They are checked in because the retro-arcade treatment is a scored deliverable,
not decoration — the styling pass at hours 19–21 is graded against these images
side by side, and a half-styled version of them looks worse than a plain UI
honestly built.

## The screens

Numbered in flow order, not in the order they were exported.

| File | Screen | Route | Tier |
|---|---|---|---|
| `01-splash.jpeg` | Splash — "click to continue" | `/splash` | P1 · **superseded**, see below |
| `02-login.jpeg` | Log In — email + password | `/login` | P1 |
| `03-signup-create-profile.jpeg` | Create Profile | `/signup` | P1 |
| `04-home-repo-entry.jpeg` | Home — "Would you kindly…?" | `/` | P0 |
| `05-start-confirm.jpeg` | Confirm and start — "Would you kindly… start?" | `/runs/[runId]/start` | P0 |
| `06-quiz-question.jpeg` | Quiz — question, options, HUD | `/runs/[runId]/quiz` | P0 |
| `07-quiz-complete.jpeg` | Quiz Complete — score, mastery, breakdown | `/runs/[runId]/complete` | P0 |
| `08-history.jpeg` | Quiz History | `/history` | P0 |
| `09-report.jpeg` | Reports dashboard | `/report` | P1 |
| `10-settings.jpeg` | Settings | `/settings` | P1/P2 |

## Two screens have no mockup

**Ingesting** (`/runs/[runId]`) and **Answer Review** (`/runs/[runId]/answers`)
were never drawn. Both are built in the same panel frame as the screens that
were. They are not filler:

- Ingesting is the only screen a judge waits on, so it narrates staged progress
  (fetching → indexing → generating) rather than spinning.
- Answer Review is where the citation pipeline becomes visible. Without it, the
  verification work that separates this from a trivia generator is invisible.

## The landing screen replaced the splash mockup

`01-splash.jpeg` shows a static "click to continue" title card. What shipped at
`/splash` is a Three.js rocket flying through a starfield, with the wordmark,
the product sentence and a `PRESS START` link to log in
(`src/components/ui/pixel-rocket-voyager.tsx`).

It keeps what the mockup was for -- the arcade title card that sets the tone in
the first two seconds -- and does the job better, so the mockup is kept as the
record of the original intent rather than as a target to match.

One thing the mockup did not anticipate: first visits are now *routed* through
this screen. `proxy.ts` redirects any browser without the `rpo_seen` cookie to
`/splash`, so the intended landing -> log in -> Home order actually holds
instead of depending on where someone happens to land.

## Known deviations in the implementation

Deliberate, and worth knowing before anyone "fixes" them:

- **Progress pips.** `06-quiz-question.jpeg` draws seven pips for a five-question
  quiz. The implementation renders one pip per question, so five.
- **Mastery spelling.** The mockup reads `WELL KNOWLEDGABLE!`. The PRD tier is
  "Well Knowledgeable", and the implementation follows the PRD.
- **Right rail placement.** `05-start-confirm.jpeg` shows Your Progress and
  Current Streak beside the start panel; the PRD scopes the rail to the quiz.
  The implementation follows the PRD and shows it only during the quiz.
- **Streak captions.** The mockups add a caption beside the streak count
  ("Start your streak!", "Keep it going!"). Not yet implemented.
- **The room.** The bedroom scene is one flat illustration in the mockups. The
  implementation approximates it with CSS gradients (`.room-scene` in
  `src/app/globals.css`) until the asset is exported to `public/room.webp`.
  Rebuilding the shelves, posters and cat in markup is a day of work no judge
  will award a point for.

## Working against these

The interface lives at `src/app/(auth)` and `src/app/(app)`. The palette, the
pixel panel/button/input primitives and the fonts are centralized in
`src/app/globals.css` — change a color there, not in a component.

Below the `md` breakpoint the room scene does not survive: the background drops
to a flat gradient, the left nav becomes a bottom bar, and the HUD collapses to
score plus hearts. None of the mockups show that state; it is specified in the
PRD instead.
