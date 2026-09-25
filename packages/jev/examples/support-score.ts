import type { Judgment, JudgmentSupportFor, Goal } from "@factbag/core/query";

/**
 * Demo-only weakest-link/strongest-route scoring for settled positive atom,
 * AND, and OR proofs. This is a support index, not a posterior probability.
 * Unsupported goals or unscored evidence return null, never an invented score.
 */
export function supportScore(judgment: Judgment): number | null {
  if (judgment.value !== "true") {
    return null;
  }
  if (judgment.goal.kind === "atom") {
    return combine(judgment.positive.map(scoreAtomSupport), Math.max);
  }
  if (judgment.goal.kind === "and" || judgment.goal.kind === "or") {
    const children = judgment.positive.flatMap((support) =>
      support.source === "subgoals" ? support.judgments : [],
    );
    if (judgment.goal.kind === "and") {
      return combine(children.map(supportScore), Math.min);
    }
    return combine(children.filter((child) => child.value === "true").map(supportScore), Math.max);
  }
  return null;
}

function scoreAtomSupport(support: JudgmentSupportFor<Goal>): number | null {
  if (support.source === "rule") {
    return supportScore(support.body);
  }
  if (support.source === "evidence") {
    return combine(
      support.literals.map((literal) => {
        // A caller may explicitly give structured evidence a support weight.
        // Absence of a model probability is never silently treated as certainty.
        const score =
          literal.metadata?.scores?.["support"] ?? literal.metadata?.scores?.["probability"];
        return score !== undefined && Number.isFinite(score) && score >= 0 && score <= 1
          ? score
          : null;
      }),
      Math.max,
    );
  }
  return null;
}

function combine(
  values: readonly (number | null)[],
  operation: (...values: number[]) => number,
): number | null {
  if (values.length === 0 || values.some((value) => value === null)) {
    return null;
  }
  return operation(...values.filter((value): value is number => value !== null));
}
