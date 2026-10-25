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

type ExplanationContext = {
  explanations: WeakMap<Judgment, Explanation>;
  contentKeys: WeakMap<Explanation, number>;
  keyIds: Map<string, number>;
};

/**
 * Convert a judgment's proof-support graph into a compact, LLM-readable
 * {@link Explanation} of what was concluded and why.
 *
 * The result is a directed acyclic graph (DAG): reused judgment objects share
 * explanation nodes within this call. Serializing the result as JSON still
 * expands shared nodes at every path to them.
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
  return explainWithContext(judgment, {
    explanations: new WeakMap(),
    contentKeys: new WeakMap(),
    keyIds: new Map(),
  });
}

function explainWithContext(judgment: Judgment, context: ExplanationContext): Explanation {
  let explanation = context.explanations.get(judgment);
  if (explanation === undefined) {
    explanation = explainOnce(judgment, context);
    context.explanations.set(judgment, explanation);
  }
  return explanation;
}

function explainOnce(judgment: Judgment, context: ExplanationContext): Explanation {
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
      given: [explainWithContext(ruleSupport.body, context)],
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
      given: uniqueExplanations(
        subgoals.map((subgoal) => explainWithContext(subgoal, context)),
        context,
      ),
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

function uniqueExplanations(
  explanations: readonly Explanation[],
  context: ExplanationContext,
): readonly Explanation[] {
  const seen = new Set<number>();
  const unique: Explanation[] = [];

  for (const explanation of explanations) {
    const key = contentKey(explanation, context);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(explanation);
    }
  }

  return unique;
}

/**
 * Equal serialized content gets the same ID; different derivations of the same
 * claim remain distinct. Child IDs keep each key local to a node rather than expanding
 * the subtree; the per-call table releases its strings after rendering.
 */
function contentKey(explanation: Explanation, context: ExplanationContext): number {
  let id = context.contentKeys.get(explanation);
  if (id === undefined) {
    const given =
      "given" in explanation
        ? explanation.given.map((child) => contentKey(child, context))
        : undefined;
    const because = "because" in explanation ? explanation.because : undefined;
    const key = JSON.stringify([explanation.claim, because, given]);
    id = context.keyIds.get(key);
    if (id === undefined) {
      id = context.keyIds.size;
      context.keyIds.set(key, id);
    }
    context.contentKeys.set(explanation, id);
  }
  return id;
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
    case "min":
    case "max":
    case "roundTo":
    case "floorTo":
    case "ceilTo":
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
