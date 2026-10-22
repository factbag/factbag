/**
 * Accuracy over entailment cases, with a 95% percentile interval from bootstrap resamples
 * of cases. A case the pipeline could not answer counts as wrong, as SARA scores it.
 */
export type Outcome = Readonly<{
  id: string;
  gold: string;
  predicted: string | undefined;
}>;

type Interval = readonly [low: number, high: number];

export type Summary = Readonly<{
  cases: number;
  correct: number;
  unanswered: number;
  accuracy: number;
  interval: Interval;
}>;

export function summarise(outcomes: readonly Outcome[]): Summary {
  const correct = outcomes.filter((outcome) => outcome.predicted === outcome.gold).length;
  return {
    cases: outcomes.length,
    correct,
    unanswered: outcomes.filter((outcome) => outcome.predicted === undefined).length,
    accuracy: outcomes.length === 0 ? 0 : correct / outcomes.length,
    interval: bootstrap(outcomes),
  };
}

function bootstrap(outcomes: readonly Outcome[], samples = 5000, seed = 20261022): Interval {
  if (outcomes.length === 0) {
    return [0, 0];
  }
  const random = mulberry32(seed);
  const accuracies: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    let correct = 0;
    for (let j = 0; j < outcomes.length; j += 1) {
      const pick = outcomes[Math.floor(random() * outcomes.length)];
      if (pick !== undefined && pick.predicted === pick.gold) {
        correct += 1;
      }
    }
    accuracies.push(correct / outcomes.length);
  }
  accuracies.sort((a, b) => a - b);
  const at = (q: number): number =>
    accuracies[Math.min(accuracies.length - 1, Math.floor(q * accuracies.length))] ?? 0;
  return [at(0.025), at(0.975)];
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
