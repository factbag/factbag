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
      because: `${formatAtom(atom, new Map(judgment.bindings))} is closed-world, and no evidence is known`,
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
      because: `${formatAtom(judgment.goal.atom, new Map(judgment.bindings))} is closed-world, and no matching evidence is known`,
    };
  }

  const primitive = supports.find((support) => support.source === "primitive");
  if (primitive !== undefined) {
    return { claim: claimForJudgment(judgment), because: primitiveReason(primitive) };
  }

  return {
    claim: claimForJudgment(judgment),
    because: "no supporting evidence or rule was found",
  };
}

/**
 * Why a comparison, arithmetic term or aggregate has its value. It is computed rather than
 * supported by evidence or a rule, unless a variable it needs was never given a value.
 */
function primitiveReason(support: JudgmentSupportFor<Goal>): string {
  const uncertainty =
    support.source === "primitive" && "evaluation" in support
      ? (support.evaluation.uncertainty ?? [])
      : [];
  const missing = uncertainty.flatMap((reason) =>
    reason.kind === "missing-binding" ? [formatValue(reason.variable)] : [],
  );
  if (missing.length > 0) {
    return `${[...new Set(missing)].join(", ")} ${missing.length === 1 ? "has" : "have"} no value`;
  }
  return uncertainty.length > 0 ? "computed from values that are not settled" : "computed";
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

/** The values a judgment's variables hold, for writing its goal as it was evaluated. */
type Values = ReadonlyMap<Var, unknown>;

const NO_VALUES: Values = new Map();

/**
 * The goal as it was evaluated, and what it came to. Variables are written as the values
 * they hold, and a variable without one keeps its name. A term that computes a value says
 * the value it computed, such as `A = mul(1000, 0.15) = 150`; every other claim ends in
 * its truth value.
 */
function claimForJudgment(judgment: Judgment): string {
  const values: Values = new Map(judgment.bindings);
  const { goal } = judgment;
  if (judgment.value === "true" && "bind" in goal && values.has(goal.bind)) {
    return `${formatComputation(goal, values)} = ${formatValue(values.get(goal.bind))}`;
  }
  return `${formatGoal(goal, values)} = ${judgment.value}`;
}

/** A computing goal with the variable it binds left as a name: `A = mul(1000, 0.15)`. */
function formatComputation(goal: Goal & { bind: Var }, values: Values): string {
  const unbound = new Map(values);
  unbound.delete(goal.bind);
  return formatGoal(goal, unbound);
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

function formatGoal(goal: Goal, values: Values = NO_VALUES): string {
  const value = (operand: unknown): string => formatValue(operand, values);
  const bound = (variable: Var): string => formatValue(variable, values);
  switch (goal.kind) {
    case "atom":
      return formatAtom(goal.atom, values);
    case "not":
      return `not(${formatGoal(goal.goal, values)})`;
    case "and":
    case "or":
      return `${goal.kind}(${goal.goals.map((subgoal) => formatGoal(subgoal, values)).join(", ")})`;
    case "exists":
      return `exists(${goal.variables.map((variable) => variable.name).join(", ")}: ${formatGoal(goal.goal, values)})`;
    case "let":
      return `let(${goal.variable.name} = ${value(goal.value)}: ${formatGoal(goal.goal, values)})`;
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "daysBetween":
    case "yearsBetween":
    case "firstOfMonth":
    case "min":
    case "max":
    case "roundTo":
    case "floorTo":
    case "ceilTo":
      return `${bound(goal.bind)} = ${goal.kind}(${value(goal.left)}, ${value(goal.right)})`;
    case "eq":
    case "neq":
    case "lt":
    case "lte":
    case "gt":
    case "gte":
      return `${goal.kind}(${value(goal.left)}, ${value(goal.right)})`;
    case "sum":
      return `${bound(goal.bind)} = sum(${value(goal.value)})`;
    case "count":
      return `${bound(goal.bind)} = count(${formatGoal(goal.where, values)})`;
    default:
      throw new AssertionError("Unhandled goal kind");
  }
}

function formatAtom(atom: AnyAtom, values: Values = NO_VALUES): string {
  const fields = atom.predicate.paramNames.map((name) => formatValue(atom.fields[name], values));
  return `${atom.predicate.name}(${fields.join(", ")})`;
}

function formatValue(value: unknown, values: Values = NO_VALUES): string {
  if (isVar(value)) {
    return values.has(value) ? formatValue(values.get(value)) : value.name;
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
