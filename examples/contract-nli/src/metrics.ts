/**
 * Scoring as in "Same Scores, Different Decisions" (arXiv 2609.27678): accuracy over every
 * intended judgment with invalid answers counted wrong, macro-F1 as the unweighted mean of
 * the three class F1 scores, class recall against the gold count, and 95% percentile
 * intervals from whole-contract bootstrap resamples.
 */
import { LABELS } from "./data";
import type { Label } from "./data";

export type Judgment = Readonly<{
  contractId: number;
  hypothesisId: string;
  gold: Label;
  predicted: Label | undefined;
}>;

type ClassScores = Readonly<{
  precision: number;
  recall: number;
  f1: number;
  support: number;
}>;

export type Metrics = Readonly<{
  judgments: number;
  correct: number;
  invalid: number;
  accuracy: number;
  macroF1: number;
  classes: Readonly<Record<Label, ClassScores>>;
}>;

export function score(judgments: readonly Judgment[]): Metrics {
  let correct = 0;
  let invalid = 0;
  const tp: Record<Label, number> = { Entailment: 0, Contradiction: 0, NotMentioned: 0 };
  const fp: Record<Label, number> = { Entailment: 0, Contradiction: 0, NotMentioned: 0 };
  const support: Record<Label, number> = { Entailment: 0, Contradiction: 0, NotMentioned: 0 };
  for (const { gold, predicted } of judgments) {
    support[gold] += 1;
    if (predicted === undefined) {
      invalid += 1;
    } else if (predicted === gold) {
      correct += 1;
      tp[gold] += 1;
    } else {
      fp[predicted] += 1;
    }
  }
  const scores = (label: Label): ClassScores => {
    const precision = ratio(tp[label], tp[label] + fp[label]);
    const recall = ratio(tp[label], support[label]);
    const f1 = ratio(2 * precision * recall, precision + recall);
    return { precision, recall, f1, support: support[label] };
  };
  const classes: Record<Label, ClassScores> = {
    Entailment: scores("Entailment"),
    Contradiction: scores("Contradiction"),
    NotMentioned: scores("NotMentioned"),
  };
  return {
    judgments: judgments.length,
    correct,
    invalid,
    accuracy: ratio(correct, judgments.length),
    macroF1: LABELS.reduce((sum, label) => sum + classes[label].f1, 0) / LABELS.length,
    classes,
  };
}

export type Interval = readonly [low: number, high: number];

/** Percentile 95% intervals over contracts resampled with replacement. */
export function bootstrap(
  judgments: readonly Judgment[],
  samples = 5000,
  seed = 20260922,
): Readonly<{ accuracy: Interval; macroF1: Interval }> {
  const byContract = new Map<number, Judgment[]>();
  for (const judgment of judgments) {
    const list = byContract.get(judgment.contractId) ?? [];
    list.push(judgment);
    byContract.set(judgment.contractId, list);
  }
  const contracts = [...byContract.values()];
  const random = mulberry32(seed);
  const accuracies: number[] = [];
  const f1s: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const sample: Judgment[] = [];
    for (let j = 0; j < contracts.length; j += 1) {
      const pick = contracts[Math.floor(random() * contracts.length)];
      if (pick !== undefined) {
        sample.push(...pick);
      }
    }
    const metrics = score(sample);
    accuracies.push(metrics.accuracy);
    f1s.push(metrics.macroF1);
  }
  return { accuracy: percentileInterval(accuracies), macroF1: percentileInterval(f1s) };
}

function percentileInterval(values: number[]): Interval {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return [at(0.025), at(0.975)];
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
