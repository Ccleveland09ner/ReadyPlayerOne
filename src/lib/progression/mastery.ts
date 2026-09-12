/**
 * Mastery tiers, XP and levels.
 *
 * The tech design is explicit that these thresholds live in exactly one place:
 * History, Quiz Complete and Report all import from here. Three copies of the
 * table is how the screens end up disagreeing.
 *
 * Progression is DERIVED, never stored — 10 XP per correct answer, 25 per
 * completed quiz, 100 XP per level. Deleting a run corrects the totals for
 * free because nothing is incremented.
 */

export type MasteryTone = "grape" | "green" | "gold" | "pink";

export type MasteryTier = {
  name: string;
  tone: MasteryTone;
  /** Inclusive lower bound as a percentage. */
  min: number;
  blurb: string;
};

const TIERS: MasteryTier[] = [
  {
    name: "Codebase Master",
    tone: "grape",
    min: 100,
    blurb: "You could open a PR in this repo today.",
  },
  {
    name: "Well Knowledgeable",
    tone: "green",
    min: 80,
    blurb: "You have a solid understanding of this codebase. Keep going!",
  },
  {
    name: "Getting There",
    tone: "gold",
    min: 60,
    blurb: "The shape is there. Read the files you missed and run it back.",
  },
  {
    name: "Keep Practicing",
    tone: "pink",
    min: 0,
    blurb: "Start with the answer review — every miss names the file to read.",
  },
];

export const MASTERY_TONE_COLOR: Record<MasteryTone, string> = {
  grape: "#a58bff",
  green: "#4ade80",
  gold: "#ffc23c",
  pink: "#ff5470",
};

/** Percentage (0–100) to its mastery tier. */
export function masteryFor(percent: number): MasteryTier {
  return TIERS.find((tier) => percent >= tier.min) ?? TIERS[TIERS.length - 1];
}

export function percentFor(score: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((score / total) * 100);
}

export const XP_PER_CORRECT = 10;
export const XP_PER_QUIZ = 25;
export const XP_PER_LEVEL = 100;

const LEVEL_NAMES = [
  "Getting Oriented",
  "Finding Your Way",
  "Reading Fluently",
  "Mapping the Repo",
  "Trusted Reviewer",
];

export function xpFor({
  correct,
  quizzes,
}: {
  correct: number;
  quizzes: number;
}): number {
  return correct * XP_PER_CORRECT + quizzes * XP_PER_QUIZ;
}

export function levelFor(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function levelName(level: number): string {
  return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1];
}

/** Everything the HUD needs, from one pair of counts. */
export function progressionFor({
  correct,
  quizzes,
}: {
  correct: number;
  quizzes: number;
}) {
  const xp = xpFor({ correct, quizzes });
  const level = levelFor(xp);
  return {
    xp,
    level,
    name: levelName(level),
    xpIntoLevel: xp % XP_PER_LEVEL,
    xpForLevel: XP_PER_LEVEL,
  };
}
