import type { AnyAtom } from "../types/atom";
import type { Goal } from "../types/goal";
import type { Judgment, JudgmentSupportFor } from "../types/judgment";
import type { AnyLiteral } from "../types/literal";
import type { AnyRule } from "../types/rule";
import { isTemporary, isVar } from "../types/variable";
import type { Var } from "../types/variable";
import { isFormula } from "../dsl/types";
import { AssertionError } from "../utils/assert";
import type { Explanation, EvidenceReason } from "./types";

type ExplanationContext = {
  /** The term that computes each temporary met so far, for writing one that has no value. */
  definitions: Map<Var, ComputingGoal>;
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
 *   "because": "doctor(P) iff and(passed_medical_school(P), has_active_license(P))",
 *   "given": [
 *     { "claim": "passed_medical_school(alice) = true" },
 *     { "claim": "has_active_license(alice) = true" }
 *   ]
 * }
 * ```
 */
export function explainJudgment(judgment: Judgment): Explanation {
  return explainWithContext(judgment, {
    definitions: new Map(),
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
      claim: claimForJudgment(judgment, context),
      because: `${formatAtom(atom, scopeOf(judgment, context))} is closed-world, and no evidence is known`,
    };
  }

  const supports = supportsForValue(judgment);
  const ruleSupport = supports.find((support) => support.source === "rule");
  if (ruleSupport !== undefined) {
    return {
      claim: claimForJudgment(judgment, context),
      because: formatRule(ruleSupport.rule),
      given: ruleBodyExplanations(ruleSupport.body, context),
    };
  }

  const evidence = supports.flatMap((support) =>
    support.source === "evidence" ? support.literals : [],
  );
  if (evidence.length > 0) {
    const claim = claimForJudgment(judgment, context);
    const reasons = evidence.map((literal) => evidenceReason(literal, claim));
    const firstReason = reasons[0];
    return {
      claim,
      because: reasons.length === 1 && firstReason !== undefined ? firstReason : reasons,
    };
  }

  const subgoals = supports.flatMap((support) =>
    support.source === "subgoals" ? support.judgments : [],
  );
  if (subgoals.length > 0) {
    return {
      claim: claimForJudgment(judgment, context),
      given: uniqueExplanations(
        subgoals.map((subgoal) => explainWithContext(subgoal, context)),
        context,
      ),
    };
  }

  const closedWorldAbsence = supports.find((support) => support.source === "closed-world-absence");
  if (closedWorldAbsence !== undefined && judgment.goal.kind === "atom") {
    return {
      claim: claimForJudgment(judgment, context),
      because: `${formatAtom(judgment.goal.atom, scopeOf(judgment, context))} is closed-world, and no matching evidence is known`,
    };
  }

  const primitive = supports.find((support) => support.source === "primitive");
  if (primitive !== undefined) {
    return {
      claim: claimForJudgment(judgment, context),
      because: primitiveReason(primitive, scopeOf(judgment, context)),
    };
  }

  return {
    claim: claimForJudgment(judgment, context),
    because: "no supporting evidence or rule was found",
  };
}

/**
 * Why a comparison, arithmetic term or aggregate has its value. It is computed rather than
 * supported by evidence or a rule, unless a variable it needs was never given a value.
 */
function primitiveReason(support: JudgmentSupportFor<Goal>, scope: Scope): string {
  const uncertainty =
    support.source === "primitive" && "evaluation" in support
      ? (support.evaluation.uncertainty ?? [])
      : [];
  const missing = uncertainty.flatMap((reason) =>
    reason.kind === "missing-binding" ? [formatValue(reason.variable, scope)] : [],
  );
  if (missing.length > 0) {
    return `${[...new Set(missing)].join(", ")} ${missing.length === 1 ? "has" : "have"} no value`;
  }
  return uncertainty.length > 0 ? "computed from values that are not settled" : "computed";
}

/**
 * What a rule application rests on. A body that is an `and` or an `or` is not a step of
 * its own: the rule already states it, so the application rests directly on the body's
 * subgoals. Any other body, such as a single atom or a negation, is the one thing it
 * rests on.
 */
function ruleBodyExplanations(body: Judgment, context: ExplanationContext): readonly Explanation[] {
  const explanation = explainWithContext(body, context);
  const combines = body.goal.kind === "and" || body.goal.kind === "or";
  return combines && "given" in explanation && !("because" in explanation)
    ? explanation.given
    : [explanation];
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

/** A goal that computes a value and binds it: arithmetic, or an aggregate. */
type ComputingGoal = Extract<Goal, { bind: Var }>;

/**
 * What a goal's variables stand for when it is written out: the values the judgment's
 * variables hold, and the terms that compute the temporaries.
 */
type Scope = Readonly<{
  values: ReadonlyMap<Var, unknown>;
  definitions: ReadonlyMap<Var, ComputingGoal>;
}>;

const NO_SCOPE: Scope = { values: new Map(), definitions: new Map() };

function scopeOf(judgment: Judgment, context: ExplanationContext): Scope {
  noteDefinitions(judgment.goal, context.definitions);
  return { values: new Map(judgment.bindings), definitions: context.definitions };
}

/** Record the term that computes each temporary in the goal. A parent is always noted before its subgoals are explained. */
function noteDefinitions(goal: Goal, definitions: Map<Var, ComputingGoal>): void {
  if ("bind" in goal && isTemporary(goal.bind)) {
    definitions.set(goal.bind, goal);
  }
  if (goal.kind === "and" || goal.kind === "or") {
    for (const subgoal of goal.goals) {
      noteDefinitions(subgoal, definitions);
    }
  }
}

/**
 * The goal as it was evaluated, and what it came to. Variables are written as the values
 * they hold, and a variable without one keeps its name. A term that computes a value says
 * the value it computed, such as `A = mul(1000, 0.15) = 150`; every other claim ends in
 * its truth value. A temporary is never named: the term that computes it stands for it.
 */
function claimForJudgment(judgment: Judgment, context: ExplanationContext): string {
  const scope = scopeOf(judgment, context);
  const { goal } = judgment;
  if ("bind" in goal) {
    const computed = scope.values.has(goal.bind) && judgment.value === "true";
    const result = computed ? formatValue(scope.values.get(goal.bind)) : judgment.value;
    return `${formatComputation(goal, scope)} = ${result}`;
  }
  return `${formatGoal(goal, scope)} = ${judgment.value}`;
}

/**
 * A computing goal with the variable it binds left as a name, `A = mul(1000, 0.15)`, or
 * with no name when it binds a temporary, `mul(1000, 0.15)`.
 */
function formatComputation(goal: ComputingGoal, scope: Scope): string {
  const values = new Map(scope.values);
  values.delete(goal.bind);
  const term = formatTerm(goal, { ...scope, values });
  return isTemporary(goal.bind) ? term : `${goal.bind.name} = ${term}`;
}

/**
 * A computing goal inside a larger one: the term and its value, `mul(1000, 0.15) = 150`,
 * or with no value the variable it would bind, `A = mul(I, 0.15)`. A temporary with no
 * value is written as its term wherever it is used, so here it is the term alone.
 */
function formatComputing(goal: ComputingGoal, scope: Scope): string {
  const term = formatTerm(goal, scope);
  if (scope.values.has(goal.bind)) {
    return `${term} = ${formatValue(scope.values.get(goal.bind))}`;
  }
  return isTemporary(goal.bind) ? term : `${goal.bind.name} = ${term}`;
}

/** The computation itself, without the variable it binds: `mul(1000, 0.15)`. */
function formatTerm(goal: ComputingGoal, scope: Scope): string {
  if (goal.kind === "sum") {
    return `sum(${formatValue(goal.value, scope)})`;
  }
  if (goal.kind === "count") {
    return `count(${formatGoal(goal.where, scope)})`;
  }
  return `${goal.kind}(${formatValue(goal.left, scope)}, ${formatValue(goal.right, scope)})`;
}

/**
 * What one piece of evidence says and where it comes from. Its claim is left out when it
 * only repeats `stepClaim` beside provenance, so a step states its claim once.
 */
function evidenceReason(literal: AnyLiteral, stepClaim: string): EvidenceReason {
  const claim = `${formatAtom(literal.atom)} = ${literal.sign === "+" ? "true" : "false"}`;
  const { source, citation, justification } = literal.metadata ?? {};
  const provenance = {
    ...(source === undefined ? {} : { source }),
    ...(citation === undefined ? {} : { citation }),
    ...(justification === undefined ? {} : { justification }),
  };
  return claim === stepClaim && Object.keys(provenance).length > 0
    ? provenance
    : { claim, ...provenance };
}

/** A rule as its author wrote it. The values it was applied to are in the claims it supports. */
function formatRule(rule: AnyRule): string {
  return `${formatLiteral(rule.head)} ${rule.kind} ${formatRuleBody(rule.body)}`;
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

function formatGoal(goal: Goal, scope: Scope = NO_SCOPE): string {
  switch (goal.kind) {
    case "atom":
      return formatAtom(goal.atom, scope);
    case "not":
      return `not(${formatGoal(goal.goal, scope)})`;
    case "and":
    case "or":
      return `${goal.kind}(${goal.goals.map((subgoal) => formatGoal(subgoal, scope)).join(", ")})`;
    case "exists":
      return `exists(${goal.variables.map((variable) => variable.name).join(", ")}: ${formatGoal(goal.goal, scope)})`;
    case "let":
      return `let(${goal.variable.name} = ${formatValue(goal.value, scope)}: ${formatGoal(goal.goal, scope)})`;
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
    case "sum":
    case "count":
      return formatComputing(goal, scope);
    case "eq":
    case "neq":
    case "lt":
    case "lte":
    case "gt":
    case "gte":
      return `${goal.kind}(${formatValue(goal.left, scope)}, ${formatValue(goal.right, scope)})`;
    default:
      throw new AssertionError("Unhandled goal kind");
  }
}

function formatAtom(atom: AnyAtom, scope: Scope = NO_SCOPE): string {
  const fields = atom.predicate.paramNames.map((name) => formatValue(atom.fields[name], scope));
  return `${atom.predicate.name}(${fields.join(", ")})`;
}

function formatValue(value: unknown, scope: Scope = NO_SCOPE): string {
  if (isVar(value)) {
    if (scope.values.has(value)) {
      return formatValue(scope.values.get(value));
    }
    const definition = scope.definitions.get(value);
    return definition === undefined ? value.name : formatTerm(definition, scope);
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
    // A date at UTC midnight is a day; its time of day is noise.
    const text = value.toISOString();
    return text.endsWith("T00:00:00.000Z") ? text.slice(0, 10) : text;
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
