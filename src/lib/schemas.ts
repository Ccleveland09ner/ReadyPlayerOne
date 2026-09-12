import { z } from "zod";

/**
 * Zod schemas for route boundaries and model output.
 *
 * Two jobs. At the route boundary, these reject malformed client input before
 * it reaches a query. On the model response, they make a malformed generation
 * a caught, retryable error rather than a `TypeError: cannot read property
 * 'label' of undefined` three call frames later.
 */

// --- Route input ------------------------------------------------------------

export const createRunInput = z.object({
  repoUrl: z.string().min(1).max(400),
});

export const indexBatchInput = z.object({
  batchSize: z.number().int().min(1).max(20).optional(),
});

export const submitAnswerInput = z.object({
  questionId: z.string().uuid(),
  selectedIndex: z.number().int().min(0).max(3),
});

// --- Model output -----------------------------------------------------------

export const TOPICS = [
  "file_structure",
  "core_logic",
  "apis",
  "testing",
  "deployment",
] as const;

export const generatedCitation = z.object({
  path: z.string().min(1),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
});

export const generatedOption = z.object({
  label: z.enum(["A", "B", "C", "D"]),
  text: z.string().min(1),
  explanation: z.string().min(1),
  citation: generatedCitation.nullable(),
});

export const generatedQuestion = z.object({
  topic: z.enum(TOPICS),
  prompt: z.string().min(1),
  options: z.array(generatedOption).length(4),
  correctIndex: z.number().int().min(0).max(3),
});

export const generatedQuiz = z.object({
  questions: z.array(generatedQuestion).length(5),
});

export type GeneratedQuiz = z.infer<typeof generatedQuiz>;
export type GeneratedQuestion = z.infer<typeof generatedQuestion>;
export type GeneratedOption = z.infer<typeof generatedOption>;
