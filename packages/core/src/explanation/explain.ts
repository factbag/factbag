import type { AnyAtom } from "../types/atom";
import type { Goal } from "../types/goal";
import type { Judgment, JudgmentSupportFor } from "../types/judgment";
import type { AnyLiteral } from "../types/literal";
import type { AnyRule } from "../types/rule";
import { isVar } from "../types/variable";
import type { Var } from "../types/variable";
import { isFormula } from "../dsl/types";
import { AssertionError } from "../utils/assert";
import type { Explanation, EvidenceReason } from "./types";

/**
 * Convert a judgment's proof-support tree into a compact, LLM-readable
 * {@link Explanation} of what was concluded and why.
 *
 * @example
 * ```ts
 * const explanation = explainJudgment(query(kb, doctor({ person: alice })));
 * ```
 * Yields nested explanation nodes such as:
 * ```json
 * {
 *   "claim": "doctor(alice) = true",
 *   "because": "doctor(P) iff and(passed_medical_school(P), has_active_license(P)), with P = alice",
 *   "given": [{ "claim": "and(...) = true" }]
 * }
 * ```
 */
export function explainJudgment(judgment: Judgment): Explanation {
  if (isClosedWorldAbsence(judgment)) {
    const atom = judgment.goal.goal.atom;
    return {
      claim: claimForJudgment(judgment),
      because: `${formatAtom(atom)} is closed-world, and no evidence is known`,
    };
  }

  const supports = supportsForValue(judgment);
  const ruleSupport = supports.find((support) => support.source === "rule");
  if (ruleSupport !== undefined) {
    return {
      claim: claimForJudgment(judgment),
      because: formatRuleApplication(ruleSupport.rule, ruleSupport.body.bindings),
      given: [explainJudgment(ruleSupport.body)],
    };
  }

  const evidence = supports.flatMap((support) =>
    support.source === "evidence" ? support.literals : [],
  );
  if (evidence.length > 0) {
    const reasons = evidence.map(evidenceReason);
    const firstReason = reasons[0];
    return {
      claim: claimForJudgment(judgment),
      because: reasons.length === 1 && firstReason !== undefined ? firstReason : reasons,
    };
  }

  const subgoals = supports.flatMap((support) =>
    support.source === "subgoals" ? support.judgments : [],
  );
  if (subgoals.length > 0) {
    return {
      claim: claimForJudgment(judgment),
      given: uniqueExplanations(subgoals.map(explainJudgment)),
    };
  }

  const closedWorldAbsence = supports.find((support) => support.source === "closed-world-absence");
  if (closedWorldAbsence !== undefined && judgment.goal.kind === "atom") {
    return {
      claim: claimForJudgment(judgment),
      because: `${formatAtom(judgment.goal.atom)} is closed-world, and no matching evidence is known`,
    };
  }

  return {
    claim: claimForJudgment(judgment),
    because: "no supporting evidence or rule was found",
  };
}

function uniqueExplanations(explanations: readonly Explanation[]): readonly Explanation[] {
  const seen = new Set<string>();
  const unique: Explanation[] = [];

  for (const explanation of explanations) {
    const key = JSON.stringify(explanation);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(explanation);
    }
  }

  return unique;
}

function supportsForValue(judgment: Judgment): readonly JudgmentSupportFor<Goal>[] {
  if (judgment.value === "true") {
    return judgment.positive;
  }
  if (judgment.value === "false") {
    return judgment.negative;
  }
  if (judgment.value === "conflicted") {
    return [...judgment.positive, ...judgment.negative];
  }
  return judgment.inconclusive ?? [];
}

function isClosedWorldAbsence(judgment: Judgment): judgment is Judgment & {
  goal: { kind: "not"; goal: { kind: "atom"; atom: AnyAtom } };
} {
  if (judgment.goal.kind !== "not" || judgment.goal.goal.kind !== "atom") {
    return false;
  }
  if (judgment.value !== "true") {
    return false;
  }

  const [support] = judgment.positive;
  const [child] = support?.source === "subgoals" ? support.judgments : [];
  if (child === undefined || judgment.goal.goal.atom.predicate.world !== "closed") {
    return false;
  }

  if (child.value === "unknown") {
    return true;
  }

  return (
    child.value === "false" &&
    child.negative.some((childSupport) => childSupport.source === "closed-world-absence")
  );
}

function claimForJudgment(judgment: Judgment): string {
  return `${formatGoal(judgment.goal)} = ${judgment.value}`;
}

function evidenceReason(literal: AnyLiteral): EvidenceReason {
  const claim = `${formatAtom(literal.atom)} = ${literal.sign === "+" ? "true" : "false"}`;
  const source = literal.metadata?.source;
  return source === undefined ? { claim } : { claim, source };
}

function formatRuleApplication(
  rule: AnyRule,
  bindings: readonly (readonly [Var, unknown])[],
): string {
  const base = `${formatLiteral(rule.head)} ${rule.kind} ${formatRuleBody(rule.body)}`;
  if (bindings.length === 0) {
    return base;
  }

  return `${base}, with ${bindings.map(([variable, value]) => `${variable.name} = ${formatValue(value)}`).join(", ")}`;
}

function formatRuleBody(body: unknown): string {
  if (isLiteral(body)) {
    return formatLiteral(body);
  }
  if (isAtom(body)) {
    return formatAtom(body);
  }
  if (isFormula(body)) {
    return `${body.kind}(${body.args.map(formatRuleBody).join(", ")})`;
  }
  return formatValue(body);
}

function formatLiteral(literal: AnyLiteral): string {
  return literal.sign === "-" ? `not(${formatAtom(literal.atom)})` : formatAtom(literal.atom);
}

function formatGoal(goal: Goal): string {
  switch (goal.kind) {
    case "atom":
      return formatAtom(goal.atom);
    case "not":
      return `not(${formatGoal(goal.goal)})`;
    case "and":
    case "or":
      return `${goal.kind}(${goal.goals.map(formatGoal).join(", ")})`;
    case "exists":
      return `exists(${goal.variables.map((variable) => variable.name).join(", ")}: ${formatGoal(goal.goal)})`;
    case "let":
      return `let(${goal.variable.name} = ${formatValue(goal.value)}: ${formatGoal(goal.goal)})`;
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "daysBetween":
    case "yearsBetween":
      return `${goal.bind.name} = ${goal.kind}(${formatValue(goal.left)}, ${formatValue(goal.right)})`;
    case "eq":
    case "neq":
    case "lt":
    case "lte":
    case "gt":
    case "gte":
      return `${goal.kind}(${formatValue(goal.left)}, ${formatValue(goal.right)})`;
    case "sum":
      return `${goal.bind.name} = sum(${formatValue(goal.value)})`;
    case "count":
      return `${goal.bind.name} = count(${formatGoal(goal.where)})`;
    default:
      throw new AssertionError("Unhandled goal kind");
  }
}

function formatAtom(atom: AnyAtom): string {
  const values = atom.predicate.paramNames.map((name) => formatValue(atom.fields[name]));
  return `${atom.predicate.name}(${values.join(", ")})`;
}

function formatValue(value: unknown): string {
  if (isVar(value)) {
    return value.name;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function isLiteral(value: unknown): value is AnyLiteral {
  return (
    typeof value === "object" &&
    value !== null &&
    "sign" in value &&
    "atom" in value &&
    (value.sign === "+" || value.sign === "-")
  );
}

function isAtom(value: unknown): value is AnyAtom {
  return typeof value === "object" && value !== null && "predicate" in value && "fields" in value;
}
