import {
  atomEquals,
  fieldEquals,
  fieldIdentityToken,
  isAtomLike,
  isAtomForPredicate,
  isGroundAtom,
} from "../types/atom";
import { PrimitiveArithmeticProgrammerError } from "../exceptions/programmer-errors";
import { daysBetween, yearsBetween } from "./calendar";
import type { AnyAtom, Atom, GroundAtom } from "../types/atom";
import type {
  AndGoal,
  ArithmeticGoal,
  ArithmeticKind,
  CountGoal,
  ComparisonGoal,
  ExistsGoal,
  Goal,
  GoalExpression,
  GroundAtomGoal,
  NotGoal,
  OrGoal,
  SumGoal,
} from "../types/goal";
import { ARITHMETIC_KINDS } from "../types/goal";
import type { Bindings, GoalValue } from "../types/common";
import type {
  Judgment,
  MissingBinding,
  PrimitiveEvaluation,
  QueryAllJudgment,
  QueryJudgment,
  RuleSupport,
} from "../types/judgment";
import type { AnyLiteral, Literal } from "../types/literal";
import type { PredicateDeclaration } from "../types/predicate";
import type { AnyRule } from "../types/rule";
import type { PredicateSchema } from "../types/schema";
import { isVar, Var } from "../types/variable";
import { isFormula, type Scalar } from "../dsl/types";
import { assert, AssertionError } from "../utils/assert";
import { validateQuery } from "./query-validation";
import {
  maxGoalValue,
  minGoalValue,
  negateAsFailureGoalValue,
  negateGoalValue,
} from "./goal-value";
import { groundAtom, matchPattern, matchRuleForAtom } from "./matching";
import { CandidateSearch } from "./candidate-search";
import { ProgramIndex } from "./program-index";

const UNBOUND: unique symbol = Symbol("factbag.unbound");
type Unbound = typeof UNBOUND;
type DefinedValue = string | number | boolean | object;
type SolverValue = DefinedValue | Unbound;

type NumericRangeValue = Readonly<{
  kind: "numeric-range";
  lower: number;
  upper: number | "infinity";
  uncertainty: readonly CountUncertainty[];
}>;

type CountUncertainty =
  | Readonly<{ kind: "conflict"; count: number }>
  | Readonly<{ kind: "unknown"; count: number }>
  | Readonly<{ kind: "open-world" }>;

type SearchContext = {
  candidates: CandidateSearch;
  judgments: Map<PredicateDeclaration, Map<string, QueryJudgment>>;
  index: ProgramIndex;
};

type ActiveAtoms = ReadonlyMap<string, PredicateDeclaration>;

export function solveQueryAll<Schema extends PredicateSchema>(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  atom: Atom<Schema>,
): QueryAllJudgment<Schema> {
  validateQuery(literals, rules, atom);
  const result = solveQueryAllInternal(literals, rules, atom, new Map(), {
    candidates: new CandidateSearch(rules),
    judgments: new Map(),
    index: new ProgramIndex(literals, rules),
  });

  const stack: unknown[] = [result];
  const visited = new Set<object>();
  while (stack.length > 0) {
    const value = stack.pop();
    assert(value !== UNBOUND, "Public query result must not contain UNBOUND");
    if (typeof value === "object" && value !== null) {
      if (visited.has(value)) {
        continue;
      }
      visited.add(value);
    }
    if (Array.isArray(value)) {
      for (const item of value as readonly unknown[]) {
        stack.push(item);
      }
      continue;
    }
    if (typeof value === "object" && value !== null) {
      for (const item of Object.values(value)) {
        stack.push(item);
      }
    }
  }

  return result;
}

function solveQueryAllInternal<Schema extends PredicateSchema>(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  atom: Atom<Schema>,
  active: ActiveAtoms,
  search: SearchContext,
): QueryAllJudgment<Schema> {
  if (isGroundAtom(atom)) {
    const result = solveGroundAtom(literals, rules, atom, active, search);
    assert(atomEquals(result.goal.atom, atom), "Ground query result must match queried atom");
    return [result];
  }

  return candidateGroundAtoms(literals, rules, atom, active, search).map((candidate) =>
    solveGroundAtom(literals, rules, candidate, active, search),
  );
}

function solveGroundAtom<Schema extends PredicateSchema>(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  atom: GroundAtom<Schema>,
  active: ActiveAtoms,
  search: SearchContext,
): QueryJudgment<Schema> {
  // Discovery can expose partial tables. Reuse only when no predicate this
  // judgment depends on is in a fixed-point computation.
  const dependencies = search.index.reaches(atom.predicate);
  if (search.candidates.evaluatingAmong(dependencies)) {
    return evaluateGroundAtom(literals, rules, atom, active, search);
  }

  let judgments = search.judgments.get(atom.predicate);
  if (judgments === undefined) {
    judgments = new Map();
    search.judgments.set(atom.predicate, judgments);
  }
  // An active atom of an unreachable predicate cannot be met again during this
  // evaluation, so it cannot influence the judgment. Keep only reachable contexts,
  // comparing predicate objects rather than parsing names out of atom keys.
  const relevantActive = [...active]
    .filter(([, predicate]) => dependencies.has(predicate))
    .map(([key]) => key);
  const key = JSON.stringify([groundAtomKey(atom, search), relevantActive.sort()]);
  const cached = judgments.get(key);
  if (cached !== undefined && judgmentMatchesAtom(cached, atom)) {
    return cached;
  }

  const result = evaluateGroundAtom(literals, rules, atom, active, search);
  judgments.set(key, result);
  return result;
}

function judgmentMatchesAtom<Schema extends PredicateSchema>(
  judgment: QueryJudgment,
  atom: GroundAtom<Schema>,
): judgment is QueryJudgment<Schema> {
  return atomEquals(judgment.goal.atom, atom);
}

function evaluateGroundAtom<Schema extends PredicateSchema>(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  atom: GroundAtom<Schema>,
  active: ActiveAtoms,
  search: SearchContext,
): QueryJudgment<Schema> {
  const goal: GroundAtomGoal<Schema> = { kind: "atom", atom };
  const bindings: Bindings = [];
  const atomKey = groundAtomKey(atom, search);
  const positiveLiterals = matchingLiterals(search.index.literalsFor(atom.predicate), atom, "+");
  const negativeLiterals = matchingLiterals(search.index.literalsFor(atom.predicate), atom, "-");
  const values: GoalValue[] = [];
  const positive: RuleSupport<Schema>[] = [];
  const negative: RuleSupport<Schema>[] = [];
  const inconclusive: RuleSupport<Schema>[] = [];

  if (positiveLiterals.length > 0 && negativeLiterals.length > 0) {
    values.push("conflicted");
  } else if (positiveLiterals.length > 0) {
    values.push("true");
  } else if (negativeLiterals.length > 0) {
    values.push("false");
  }

  if (!active.has(atomKey)) {
    const nextActive = new Map(active);
    nextActive.set(atomKey, atom.predicate);

    for (const rule of search.index.rulesFor(atom.predicate)) {
      const match = matchRuleForAtom(rule, atom);
      if (match === undefined) {
        continue;
      }

      const bodyResult = evaluateRuleBody(
        literals,
        rules,
        match.rule.body,
        match.bindings,
        nextActive,
        search,
      );
      const body = bodyResult.judgment;
      const contribution = ruleContribution(match.rule.kind, body.value);
      const support: RuleSupport<Schema> = {
        source: "rule",
        rule: match.rule,
        body,
      };
      if (contribution === "unknown") {
        inconclusive.push(support);
        continue;
      }

      values.push(contribution);
      if (contribution === "true" || contribution === "conflicted") {
        positive.push(support);
      }
      if (contribution === "false" || contribution === "conflicted") {
        negative.push(support);
      }
    }
  }

  if (values.length === 0) {
    if (inconclusive.length > 0) {
      return { value: "unknown", goal, bindings, inconclusive };
    }
    if (atom.predicate.world === "closed") {
      assert(positiveLiterals.length === 0, "Closed-world absence requires no positive evidence");
      assert(negativeLiterals.length === 0, "Closed-world absence requires no negative evidence");
      assert(positive.length === 0, "Closed-world absence requires no positive rules");
      assert(negative.length === 0, "Closed-world absence requires no negative rules");
      assert(inconclusive.length === 0, "Closed-world absence requires no inconclusive rules");
      return {
        value: "false",
        goal,
        bindings,
        negative: [{ source: "closed-world-absence" }],
      };
    }
    return { value: "unknown", goal, bindings };
  }

  const hasEvidenceRuleConflict =
    (positiveLiterals.length > 0 && negative.length > 0) ||
    (negativeLiterals.length > 0 && positive.length > 0);
  const value = hasEvidenceRuleConflict ? "conflicted" : maxGoalValue(...values);

  switch (value) {
    case "conflicted":
      return {
        value,
        goal,
        bindings,
        positive: [
          ...(positiveLiterals.length > 0
            ? [{ source: "evidence" as const, literals: positiveLiterals }]
            : []),
          ...positive,
        ],
        negative: [
          ...(negativeLiterals.length > 0
            ? [{ source: "evidence" as const, literals: negativeLiterals }]
            : []),
          ...negative,
        ],
      };
    case "true":
      return {
        value,
        goal,
        bindings,
        positive: [
          ...(positiveLiterals.length > 0
            ? [{ source: "evidence" as const, literals: positiveLiterals }]
            : []),
          ...positive,
        ],
      };
    case "false":
      return {
        value,
        goal,
        bindings,
        negative: [
          ...(negativeLiterals.length > 0
            ? [{ source: "evidence" as const, literals: negativeLiterals }]
            : []),
          ...negative,
        ],
      };
    case "unknown":
      return { value, goal, bindings };
    default:
      return assertNever(value, "Unhandled ground atom goal value");
  }
}

function evaluateRuleBody(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  body: unknown,
  bindings: ReadonlyMap<Var, unknown>,
  active: ActiveAtoms,
  search: SearchContext,
): BodyResult {
  const context: EvaluationContext = {
    nextTemp: 0,
    search,
  };
  const results = evaluateRuleBodyMany(literals, rules, body, bindings, active, context);
  assert(results.length > 0, "Rule body evaluation produced no results");
  const result = bestResult(results);
  assert(result !== undefined, "Rule body evaluation produced no best result");
  return result;
}

type EvaluationContext = {
  nextTemp: number;
  search: SearchContext;
  candidatePredicate?: PredicateDeclaration;
};

type BodyResult = Readonly<{
  judgment: Judgment;
  bindings: ReadonlyMap<Var, unknown>;
}>;

function assertNever(value: never, message: string): never {
  throw new AssertionError(`${message}: ${String(value)}`);
}

function evaluateRuleBodyMany(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  body: unknown,
  bindings: ReadonlyMap<Var, unknown>,
  active: ActiveAtoms,
  context: EvaluationContext,
  pathCanHaveUnavailableBindings = false,
): readonly BodyResult[] {
  if (isAtomLike(body)) {
    return evaluateAtomBody(
      literals,
      rules,
      erasedAtom(body),
      bindings,
      active,
      context,
      pathCanHaveUnavailableBindings,
    );
  }

  if (isLiteralLike(body) && body.sign === "-") {
    const bodyAtom = erasedAtom(body.atom);
    if (!canGroundAtom(bodyAtom, bindings)) {
      return [
        {
          judgment: {
            value: "unknown",
            goal: { kind: "not", goal: { kind: "atom", atom: body.atom } },
            bindings: bindingsArray(bindings),
          },
          bindings,
        },
      ];
    }

    const atom = groundAtom(bodyAtom, bindings);
    assert(
      !active.has(groundAtomKey(atom, context.search)),
      "Validated query must not recurse through negation",
    );
    const child = solveGroundAtom(literals, rules, atom, active, context.search);
    const goal: NotGoal = { kind: "not", goal: { kind: "atom", atom } };
    const value =
      atom.predicate.world === "closed"
        ? negateAsFailureGoalValue(child.value)
        : negateGoalValue(child.value);
    const judgmentBindings = bindingsArray(bindings);

    switch (value) {
      case "true":
        return [
          {
            judgment: {
              value,
              goal,
              bindings: judgmentBindings,
              positive: [
                { source: "subgoals", judgments: [withBindings(child, judgmentBindings)] },
              ],
            },
            bindings,
          },
        ];
      case "false":
        return [
          {
            judgment: {
              value,
              goal,
              bindings: judgmentBindings,
              negative: [
                { source: "subgoals", judgments: [withBindings(child, judgmentBindings)] },
              ],
            },
            bindings,
          },
        ];
      case "conflicted":
        return [
          {
            judgment: {
              value,
              goal,
              bindings: judgmentBindings,
              positive: [
                { source: "subgoals", judgments: [withBindings(child, judgmentBindings)] },
              ],
              negative: [
                { source: "subgoals", judgments: [withBindings(child, judgmentBindings)] },
              ],
            },
            bindings,
          },
        ];
      case "unknown":
        return [
          {
            judgment: {
              value,
              goal,
              bindings: judgmentBindings,
              inconclusive: [
                { source: "subgoals", judgments: [withBindings(child, judgmentBindings)] },
              ],
            },
            bindings,
          },
        ];
      default:
        return assertNever(value, "Unhandled negated goal value");
    }
  }

  if (isFormula(body, "and")) {
    return evaluateAndBody(
      literals,
      rules,
      body.args,
      bindings,
      active,
      context,
      pathCanHaveUnavailableBindings,
    );
  }

  if (isFormula(body, "or")) {
    return evaluateOrBody(
      literals,
      rules,
      body.args,
      bindings,
      active,
      context,
      pathCanHaveUnavailableBindings,
    );
  }

  if (isFormula(body, "exists")) {
    return evaluateExistsBody(
      literals,
      rules,
      body.args,
      bindings,
      active,
      context,
      pathCanHaveUnavailableBindings,
    );
  }

  if (isLetInFormula(body)) {
    return evaluateLetInBody(
      literals,
      rules,
      body.args,
      bindings,
      active,
      context,
      pathCanHaveUnavailableBindings,
    );
  }

  if (isComparisonFormula(body)) {
    return evaluateComparisonBody(
      body.kind,
      body.args,
      bindings,
      context,
      pathCanHaveUnavailableBindings,
    );
  }

  assert(!isFormula(body), "Unsupported rule body formula");

  throw new AssertionError("Unsupported rule body shape");
}

function evaluateExistsBody(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  args: readonly unknown[],
  bindings: ReadonlyMap<Var, unknown>,
  active: ActiveAtoms,
  context: EvaluationContext,
  pathCanHaveUnavailableBindings: boolean,
): readonly BodyResult[] {
  const body = args.at(-1);
  const variables = args.slice(0, -1);
  assert(body !== undefined, "exists formula must include a body");
  assert(variables.every(isVar), "exists formula quantifiers must be variables");

  return evaluateRuleBodyMany(
    literals,
    rules,
    body,
    bindings,
    active,
    context,
    pathCanHaveUnavailableBindings,
  ).map((result) => {
    const judgmentBindings = bindingsArray(result.bindings);
    const child = withBindings(result.judgment, judgmentBindings);
    const goal: ExistsGoal = { kind: "exists", variables, goal: child.goal };

    return {
      judgment: compoundExistsJudgment(goal, child.value, judgmentBindings, [child]),
      bindings: result.bindings,
    };
  });
}

function evaluateOrBody(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  args: readonly unknown[],
  bindings: ReadonlyMap<Var, unknown>,
  active: ActiveAtoms,
  context: EvaluationContext,
  pathCanHaveUnavailableBindings: boolean,
): readonly BodyResult[] {
  const candidateBindings = uniqueBindings(
    args.flatMap((arg) =>
      evaluateRuleBodyMany(
        literals,
        rules,
        arg,
        bindings,
        active,
        context,
        pathCanHaveUnavailableBindings,
      ).map((result) => result.bindings),
    ),
  );
  const environments = candidateBindings.length === 0 ? [bindings] : candidateBindings;

  // A branch is judged in an environment only by results that bind nothing beyond it. A
  // result that extends the environment belongs to the extended environment, which is
  // evaluated on its own; counting it here would let the or claim truth under bindings it
  // does not carry, and a later conjunct would then range over the unbound variable freely.
  // The extended environments are usually among the candidates already. They are not when
  // the first pass ran with a variable an earlier failed conjunct left unbound: a branch
  // then binds less than it does once the variable is bound. Such an extension is queued
  // and judged in turn, and an environment no branch fits exactly stands for nothing but
  // its extensions, so it yields no judgment of its own.
  const queue = [...environments];
  const seen = new Set(queue.map(bindingsKey));
  const results: BodyResult[] = [];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const environment = next;
    const judgments = args.flatMap((arg) => {
      const branch = evaluateRuleBodyMany(
        literals,
        rules,
        arg,
        environment,
        active,
        context,
        pathCanHaveUnavailableBindings,
      );
      for (const result of branch) {
        if (bindsBeyond(result.bindings, environment)) {
          const key = bindingsKey(result.bindings);
          if (!seen.has(key)) {
            seen.add(key);
            queue.push(result.bindings);
          }
        }
      }
      const result = bestResult(
        branch.filter((candidate) => !bindsBeyond(candidate.bindings, environment)),
      );
      return result === undefined ? [] : [result.judgment];
    });
    if (judgments.length === 0) {
      continue;
    }
    const judgmentBindings = bindingsArray(environment);
    const reboundJudgments = judgments.map((judgment) => withBindings(judgment, judgmentBindings));
    const goal: OrGoal = { kind: "or", goals: reboundJudgments.map((judgment) => judgment.goal) };

    results.push({
      judgment: compoundJudgment(
        goal,
        maxGoalValue(...reboundJudgments.map((judgment) => judgment.value)),
        judgmentBindings,
        reboundJudgments,
      ),
      bindings: environment,
    });
  }
  return results;
}

function evaluateAndBody(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  args: readonly unknown[],
  bindings: ReadonlyMap<Var, unknown>,
  active: ActiveAtoms,
  context: EvaluationContext,
  pathCanHaveUnavailableBindings: boolean,
): readonly BodyResult[] {
  let partials: readonly Readonly<{
    bindings: ReadonlyMap<Var, unknown>;
    judgments: readonly Judgment[];
  }>[] = [{ bindings, judgments: [] }];

  for (const arg of args) {
    const next: Array<
      Readonly<{
        bindings: ReadonlyMap<Var, unknown>;
        judgments: readonly Judgment[];
      }>
    > = [];

    for (const partial of partials) {
      const partialPathCanHaveUnavailableBindings =
        pathCanHaveUnavailableBindings ||
        partial.judgments.some((judgment) => judgment.value !== "true");
      const results = evaluateRuleBodyMany(
        literals,
        rules,
        arg,
        partial.bindings,
        active,
        context,
        partialPathCanHaveUnavailableBindings,
      );
      for (const result of results) {
        next.push({
          bindings: result.bindings,
          judgments: [...partial.judgments, result.judgment],
        });
      }
    }

    partials = next;
  }

  return partials.map((partial) => {
    const judgmentBindings = bindingsArray(partial.bindings);
    const judgments = partial.judgments.map((judgment) => withBindings(judgment, judgmentBindings));
    const goal: AndGoal = { kind: "and", goals: judgments.map((judgment) => judgment.goal) };

    return {
      judgment: compoundJudgment(
        goal,
        minGoalValue(...judgments.map((judgment) => judgment.value)),
        judgmentBindings,
        judgments,
      ),
      bindings: partial.bindings,
    };
  });
}

function evaluateAtomBody(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  atom: Atom,
  bindings: ReadonlyMap<Var, unknown>,
  active: ActiveAtoms,
  context: EvaluationContext,
  pathCanHaveUnavailableBindings = false,
): readonly BodyResult[] {
  const evaluateGrounded = (environment: ReadonlyMap<Var, unknown>): BodyResult => {
    const grounded = groundAtom(atom, environment);
    const judgmentBindings = bindingsArray(environment);
    // Candidate discovery needs bindings, not recursive proofs. Positive SCCs
    // cannot contain negation or aggregates. Unknown placeholders retain recursive
    // candidates unless a settled conjunct is false; prove them after discovery.
    const judgment: QueryJudgment =
      context.candidatePredicate !== undefined &&
      context.search.candidates.sameComponent(context.candidatePredicate, grounded.predicate)
        ? { value: "unknown", goal: { kind: "atom", atom: grounded }, bindings: judgmentBindings }
        : withBindings(
            solveGroundAtom(literals, rules, grounded, active, context.search),
            judgmentBindings,
          );
    return { judgment, bindings: environment };
  };

  if (canGroundAtom(atom, bindings)) {
    return [evaluateGrounded(bindings)];
  }

  const pattern: Atom = {
    predicate: atom.predicate,
    fields: Object.fromEntries(
      Object.entries(atom.fields).map(([name, value]) => [
        name,
        isVar(value) && bindings.has(value) ? bindings.get(value) : value,
      ]),
    ),
  };
  const candidateBindings = candidateGroundAtoms(
    literals,
    rules,
    pattern,
    active,
    context.search,
    pathCanHaveUnavailableBindings,
  )
    .map((candidate) => extendBindings(atom, candidate, bindings))
    .filter((candidate): candidate is ReadonlyMap<Var, unknown> => candidate !== undefined);

  if (candidateBindings.length === 0) {
    if (atom.predicate.world === "closed") {
      assert(!canGroundAtom(atom, bindings), "Ground closed-world absence must use ground solving");
      return [
        {
          judgment: {
            value: "false",
            goal: { kind: "atom", atom },
            bindings: bindingsArray(bindings),
            negative: [{ source: "closed-world-absence" }],
          },
          bindings,
        },
      ];
    }

    return [
      {
        judgment: {
          value: "unknown",
          goal: { kind: "atom", atom },
          bindings: bindingsArray(bindings),
        },
        bindings,
      },
    ];
  }

  return candidateBindings.map(evaluateGrounded);
}

function evaluateComparisonBody(
  kind: "eq" | "neq" | "lt" | "lte" | "gt" | "gte",
  args: readonly unknown[],
  bindings: ReadonlyMap<Var, unknown>,
  context: EvaluationContext,
  pathCanHaveUnavailableBindings: boolean,
): readonly BodyResult[] {
  const left = evaluateExpression(args[0], bindings, context);
  const right = evaluateExpression(args[1], left.bindings, context);
  assert(isScalarGoalExpression(left.expression), "Left comparison operand must be scalar");
  assert(isScalarGoalExpression(right.expression), "Right comparison operand must be scalar");
  const nextBindings = right.bindings;
  const judgmentBindings = bindingsArray(nextBindings);
  const goal: ComparisonGoal<typeof kind> = {
    kind,
    left: left.expression,
    right: right.expression,
  };
  const hasUnavailableOperand = left.value === UNBOUND || right.value === UNBOUND;
  assert(
    !hasUnavailableOperand || pathCanHaveUnavailableBindings,
    "Primitive comparison operands must be bound",
  );
  const value: GoalValue = hasUnavailableOperand
    ? "unknown"
    : compareValues(kind, left.value, right.value);
  const comparison = primitiveComparisonJudgment(
    goal,
    value,
    judgmentBindings,
    left.value,
    left.expression,
    right.value,
    right.expression,
  );
  const judgments = [...left.judgments, ...right.judgments, comparison];

  if (judgments.length === 1) {
    return [{ judgment: comparison, bindings: nextBindings }];
  }

  const andGoal: AndGoal = { kind: "and", goals: judgments.map((judgment) => judgment.goal) };
  return [
    {
      judgment: compoundJudgment(
        andGoal,
        minGoalValue(...judgments.map((judgment) => judgment.value)),
        judgmentBindings,
        judgments,
      ),
      bindings: nextBindings,
    },
  ];
}

function evaluateLetInBody(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  args: readonly [unknown, unknown, unknown],
  bindings: ReadonlyMap<Var, unknown>,
  active: ActiveAtoms,
  context: EvaluationContext,
  pathCanHaveUnavailableBindings: boolean,
): readonly BodyResult[] {
  const [variable, valueExpression, body] = args;
  assert(isVar(variable), "letIn binder must be a variable");

  if (isAggregateFormula(valueExpression)) {
    const aggregate = evaluateAggregateInto(
      literals,
      rules,
      variable,
      valueExpression,
      bindings,
      active,
      context,
    );
    switch (aggregate.kind) {
      case "incomplete":
        return [aggregate.result];
      case "complete":
        return evaluateLetBodyAfterValue(
          literals,
          rules,
          body,
          aggregate.expression,
          active,
          context,
          pathCanHaveUnavailableBindings,
        );
      default:
        return assertNever(aggregate, "Unhandled aggregate evaluation kind");
    }
  }

  if (isFormula(valueExpression) && !isArithmeticFormula(valueExpression)) {
    assert(
      isArithmeticFormula(valueExpression),
      `Unsupported letIn value formula: ${valueExpression.kind}`,
    );
  }

  const value = evaluateExpressionInto(variable, valueExpression, bindings, context);
  return evaluateLetBodyAfterValue(
    literals,
    rules,
    body,
    value,
    active,
    context,
    pathCanHaveUnavailableBindings,
  );
}

function evaluateLetBodyAfterValue(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  body: unknown,
  value: ExpressionResult,
  active: ActiveAtoms,
  context: EvaluationContext,
  pathCanHaveUnavailableBindings: boolean,
): readonly BodyResult[] {
  const results = evaluateRuleBodyMany(
    literals,
    rules,
    body,
    value.bindings,
    active,
    context,
    pathCanHaveUnavailableBindings || value.judgments.some((judgment) => judgment.value !== "true"),
  );

  return results.map((result) => {
    const judgmentBindings = bindingsArray(result.bindings);
    const judgments = [...value.judgments, result.judgment].map((judgment) =>
      withBindings(judgment, judgmentBindings),
    );
    const goal: AndGoal = { kind: "and", goals: judgments.map((judgment) => judgment.goal) };

    return {
      judgment: compoundJudgment(
        goal,
        minGoalValue(...judgments.map((judgment) => judgment.value)),
        judgmentBindings,
        judgments,
      ),
      bindings: result.bindings,
    };
  });
}

type ExpressionResult = Readonly<{
  value: SolverValue;
  expression: GoalExpression;
  bindings: ReadonlyMap<Var, unknown>;
  judgments: readonly Judgment[];
}>;

type AggregateEvaluation =
  | Readonly<{ kind: "complete"; expression: ExpressionResult }>
  | Readonly<{ kind: "incomplete"; result: BodyResult }>;

function valueForVariable(bindings: ReadonlyMap<Var, unknown>, variable: Var): SolverValue {
  if (!bindings.has(variable)) {
    return UNBOUND;
  }

  return definedValue(bindings.get(variable), "Bound variable values must be defined");
}

function definedValue(value: unknown, message: string): DefinedValue {
  assert(isDefinedValue(value), message);
  return value;
}

function isDefinedValue(value: unknown): value is DefinedValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (typeof value === "object" && value !== null)
  );
}

function isGoalExpression(value: unknown): value is GoalExpression {
  return (
    isVar(value) ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date ||
    (typeof value === "object" && value !== null && "id" in value && typeof value.id === "string")
  );
}

function isScalarGoalExpression(value: GoalExpression): value is GoalExpression<Scalar> {
  return (
    isVar(value) ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  );
}

function isNumericGoalExpression(value: unknown): value is GoalExpression<number> {
  return isVar(value) || typeof value === "number";
}

function evaluateExpression(
  expression: unknown,
  bindings: ReadonlyMap<Var, unknown>,
  context: EvaluationContext,
): ExpressionResult {
  if (isVar(expression)) {
    return {
      value: valueForVariable(bindings, expression),
      expression,
      bindings,
      judgments: [],
    };
  }

  if (isArithmeticFormula(expression)) {
    const left = evaluateExpression(expression.args[0], bindings, context);
    const right = evaluateExpression(expression.args[1], left.bindings, context);
    assert(isScalarGoalExpression(left.expression), "Left arithmetic operand must be scalar");
    assert(isScalarGoalExpression(right.expression), "Right arithmetic operand must be scalar");
    const variable = new Var(`${TEMPORARY_PREFIX}${context.nextTemp++}`);
    const goal: ArithmeticGoal<typeof expression.kind> = {
      kind: expression.kind,
      bind: variable,
      left: left.expression,
      right: right.expression,
    };
    const value = calculateValue(expression.kind, left.value, right.value, goal);
    const nextBindings = new Map(right.bindings);
    if (value !== UNBOUND) {
      nextBindings.set(variable, value);
    }
    const judgmentBindings = bindingsArray(nextBindings);
    const judgment = primitiveArithmeticJudgment(
      goal,
      judgmentBindings,
      left.value,
      left.expression,
      right.value,
      right.expression,
      variable,
      value,
    );

    return {
      value,
      expression: variable,
      bindings: nextBindings,
      judgments: [...left.judgments, ...right.judgments, judgment],
    };
  }

  assert(isGoalExpression(expression), "Expression must be a scalar, entity, or variable");
  return {
    value: definedValue(expression, "Expression values must be defined"),
    expression,
    bindings,
    judgments: [],
  };
}

function evaluateExpressionInto(
  variable: Var,
  expression: unknown,
  bindings: ReadonlyMap<Var, unknown>,
  context: EvaluationContext,
): ExpressionResult {
  const existing = valueForVariable(bindings, variable);
  if (existing !== UNBOUND) {
    return constrainBoundVariable(variable, existing, expression, bindings, context);
  }

  if (isArithmeticFormula(expression)) {
    const left = evaluateExpression(expression.args[0], bindings, context);
    const right = evaluateExpression(expression.args[1], left.bindings, context);
    assert(isScalarGoalExpression(left.expression), "Left arithmetic operand must be scalar");
    assert(isScalarGoalExpression(right.expression), "Right arithmetic operand must be scalar");
    const goal: ArithmeticGoal<typeof expression.kind> = {
      kind: expression.kind,
      bind: variable,
      left: left.expression,
      right: right.expression,
    };
    const value = calculateValue(expression.kind, left.value, right.value, goal);
    const nextBindings = new Map(right.bindings);
    if (value !== UNBOUND) {
      nextBindings.set(variable, value);
    }
    const judgmentBindings = bindingsArray(nextBindings);
    const judgment = primitiveArithmeticJudgment(
      goal,
      judgmentBindings,
      left.value,
      left.expression,
      right.value,
      right.expression,
      variable,
      value,
    );

    return {
      value,
      expression: variable,
      bindings: nextBindings,
      judgments: [...left.judgments, ...right.judgments, judgment],
    };
  }

  const value = isVar(expression)
    ? valueForVariable(bindings, expression)
    : definedValue(expression, "Expression values must be defined");
  const nextBindings = new Map(bindings);
  // A variable left unbound by a failed earlier conjunct binds nothing, as arithmetic
  // over it would, so the body is judged with the variable unavailable.
  if (value !== UNBOUND) {
    nextBindings.set(variable, value);
  }

  return { value, expression: variable, bindings: nextBindings, judgments: [] };
}

/**
 * A `letIn` whose variable is already bound is a constraint, not a rebinding: the
 * computed value must equal the existing one, exactly as atom matching treats a
 * repeated variable. Rebinding would let a rule conclude a head atom for a value
 * the body never produced, so an `or` branch evaluated under another branch's
 * bindings could report those bindings as true.
 */
function constrainBoundVariable(
  variable: Var,
  existing: DefinedValue,
  expression: unknown,
  bindings: ReadonlyMap<Var, unknown>,
  context: EvaluationContext,
): ExpressionResult {
  const computed = evaluateExpression(expression, bindings, context);
  assert(
    isScalarGoalExpression(computed.expression),
    "A let binding of a bound variable must compare scalar values",
  );
  const goal: ComparisonGoal<"eq"> = { kind: "eq", left: variable, right: computed.expression };
  const value: GoalValue =
    computed.value === UNBOUND ? "unknown" : compareValues("eq", existing, computed.value);
  const comparison = primitiveComparisonJudgment(
    goal,
    value,
    bindingsArray(computed.bindings),
    existing,
    variable,
    computed.value,
    computed.expression,
  );

  return {
    value: existing,
    expression: variable,
    bindings: computed.bindings,
    judgments: [...computed.judgments, comparison],
  };
}

function evaluateAggregateInto(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  variable: Var,
  aggregate: Readonly<{
    kind: "sum" | "count";
    args:
      | readonly [unknown, unknown]
      | readonly [unknown, unknown, Readonly<{ completeWhen?: unknown }>];
  }>,
  bindings: ReadonlyMap<Var, unknown>,
  active: ActiveAtoms,
  context: EvaluationContext,
): AggregateEvaluation {
  const [valueExpression, whereBody, options] = aggregate.args;
  const completeWhen = options?.completeWhen;
  const rowResults = evaluateRuleBodyMany(literals, rules, whereBody, bindings, active, context);
  const rows = rowResults.filter((result) => result.judgment.value === "true");
  const possibleRows = rowResults.filter(
    (result) =>
      result.judgment.value !== "false" &&
      (aggregate.kind !== "count" || aggregateValueIsAvailable(valueExpression, result.bindings)),
  );
  const whereGoal = aggregateWhereGoal(possibleRows.map((row) => row.judgment));

  if (completeWhen !== undefined) {
    const completenessResults = evaluateRuleBodyMany(
      literals,
      rules,
      completeWhen,
      bindings,
      active,
      context,
    );
    assert(completenessResults.length > 0, "Aggregate completeness evaluation produced no results");
    const completeness = bestResult(completenessResults);
    assert(completeness !== undefined, "Aggregate completeness evaluation produced no best result");
    if (completeness.judgment.value !== "true") {
      const judgmentBindings = bindingsArray(bindings);
      let goal: SumGoal | CountGoal;

      switch (aggregate.kind) {
        case "sum":
          assert(isNumericGoalExpression(valueExpression), "Sum value must be numeric");
          goal = {
            kind: "sum",
            bind: variable,
            value: valueExpression,
            where: whereGoal,
            completeWhen: completeness.judgment.goal,
          };
          break;
        case "count":
          goal = {
            kind: "count",
            bind: variable,
            where: whereGoal,
            completeWhen: completeness.judgment.goal,
          };
          break;
        default:
          return assertNever(aggregate.kind, "Unhandled aggregate kind");
      }

      return {
        kind: "incomplete",
        result: {
          judgment: { value: "unknown", goal, bindings: judgmentBindings },
          bindings,
        },
      };
    }
  }

  // An already-bound variable is constrained by the aggregate, not rebound: the
  // total is computed into a temporary and compared, as constrainBoundVariable does.
  const existing = valueForVariable(bindings, variable);
  const target = existing === UNBOUND ? variable : new Var(`$tmp${context.nextTemp++}`);
  const nextBindings = new Map(bindings);
  const values = rows.map((row) => resolveAggregateValue(valueExpression, row.bindings));
  let value: number | NumericRangeValue;
  let judgment: Judgment<SumGoal> | Judgment<CountGoal>;

  switch (aggregate.kind) {
    case "sum":
      assert(isNumericGoalExpression(valueExpression), "Sum value must be numeric");
      value = sumValues(values);
      nextBindings.set(target, value);
      judgment = primitiveSumJudgment(
        {
          kind: "sum",
          bind: target,
          value: valueExpression,
          where: whereGoal,
        },
        bindingsArray(nextBindings),
        values,
        target,
        value,
      );
      break;
    case "count": {
      const range = countRange(possibleRows, isOpenAggregate(whereBody));
      value = exactCountValue(range);
      nextBindings.set(target, value);
      judgment = primitiveCountJudgment(
        { kind: "count", bind: target, where: whereGoal },
        bindingsArray(nextBindings),
        range,
        target,
        value,
      );
      break;
    }
    default:
      return assertNever(aggregate.kind, "Unhandled aggregate kind");
  }

  if (existing === UNBOUND) {
    return {
      kind: "complete",
      expression: { value, expression: variable, bindings: nextBindings, judgments: [judgment] },
    };
  }

  const goal: ComparisonGoal<"eq"> = { kind: "eq", left: variable, right: target };
  const comparison = primitiveComparisonJudgment(
    goal,
    compareValues("eq", existing, value),
    bindingsArray(nextBindings),
    existing,
    variable,
    value,
    target,
  );
  return {
    kind: "complete",
    expression: {
      value: existing,
      expression: variable,
      bindings: nextBindings,
      judgments: [judgment, comparison],
    },
  };
}

function resolveAggregateValue(
  expression: unknown,
  bindings: ReadonlyMap<Var, unknown>,
): DefinedValue {
  const value = isVar(expression)
    ? valueForVariable(bindings, expression)
    : definedValue(expression, "Aggregate values must be defined");
  assert(value !== UNBOUND, "Aggregate variables must be bound");
  return value;
}

function aggregateValueIsAvailable(
  expression: unknown,
  bindings: ReadonlyMap<Var, unknown>,
): boolean {
  if (!isVar(expression)) {
    return expression !== undefined;
  }

  return valueForVariable(bindings, expression) !== UNBOUND;
}

function sumValues(values: readonly DefinedValue[]): number {
  return values.reduce<number>((total, value) => {
    assert(typeof value === "number", "Sum values must be numbers");
    return total + value;
  }, 0);
}

function aggregateWhereGoal(judgments: readonly Judgment[]): Goal {
  if (judgments.length === 1) {
    const judgment = judgments[0];
    assert(judgment !== undefined, "Expected one aggregate row judgment");
    return judgment.goal;
  }

  return { kind: "or", goals: judgments.map((judgment) => judgment.goal) };
}

function countRange(rows: readonly BodyResult[], open: boolean): NumericRangeValue {
  const definite = rows.filter((row) => row.judgment.value === "true").length;
  const conflicted = rows.filter((row) => row.judgment.value === "conflicted").length;
  const unknown = rows.filter((row) => row.judgment.value === "unknown").length;
  const uncertainty: CountUncertainty[] = [];

  if (conflicted > 0) {
    uncertainty.push({ kind: "conflict", count: conflicted });
  }
  if (unknown > 0) {
    uncertainty.push({ kind: "unknown", count: unknown });
  }
  if (open) {
    uncertainty.push({ kind: "open-world" });
  }

  return {
    kind: "numeric-range",
    lower: definite,
    upper: open ? "infinity" : definite + conflicted + unknown,
    uncertainty,
  };
}

function exactCountValue(range: NumericRangeValue): number | NumericRangeValue {
  return range.uncertainty.length === 0 && range.upper !== "infinity" && range.lower === range.upper
    ? range.lower
    : range;
}

function isOpenAggregate(whereBody: unknown): boolean {
  if (isAtomLike(whereBody)) {
    return whereBody.predicate.world === "open";
  }
  if (isFormula(whereBody, "and") || isFormula(whereBody, "or")) {
    return whereBody.args.some(isOpenAggregate);
  }
  if (isFormula(whereBody, "exists")) {
    const body = whereBody.args.at(-1);
    return body !== undefined && isOpenAggregate(body);
  }
  return true;
}

function primitiveSumJudgment(
  goal: SumGoal,
  bindings: Bindings,
  values: readonly unknown[],
  variable: Var,
  value: unknown,
): Judgment<SumGoal> {
  return {
    value: "true",
    goal,
    bindings,
    positive: [
      primitiveSupport({
        operation: "sum",
        operands: values,
        value: "true",
        result: value,
        results: [[variable, value]],
        ...primitiveRangeForExact(value),
      }),
    ],
  };
}

function primitiveCountJudgment(
  goal: CountGoal,
  bindings: Bindings,
  range: NumericRangeValue,
  variable: Var,
  value: number | NumericRangeValue,
): Judgment<CountGoal> {
  return {
    value: "true",
    goal,
    bindings,
    positive: [
      primitiveSupport({
        operation: "count",
        operands: [],
        value: "true",
        result: value,
        results: [[variable, value]],
        range: { lower: range.lower, upper: range.upper },
        ...(range.uncertainty.length === 0 ? {} : { uncertainty: range.uncertainty }),
      }),
    ],
  };
}

function primitiveArithmeticJudgment(
  goal: ArithmeticGoal<ArithmeticKind>,
  bindings: Bindings,
  left: unknown,
  leftExpression: GoalExpression,
  right: unknown,
  rightExpression: GoalExpression,
  variable: Var,
  value: SolverValue,
): Judgment<typeof goal> {
  if (value === UNBOUND) {
    assert(
      left === UNBOUND || right === UNBOUND,
      "Unknown primitive arithmetic requires an unavailable operand",
    );
    const evaluation: PrimitiveEvaluation = {
      operation: goal.kind,
      operands: [publicOperand(left, leftExpression), publicOperand(right, rightExpression)],
      value: "unknown",
      uncertainty: missingBindingUncertainty(left, leftExpression, right, rightExpression),
    };
    return { value: "unknown", goal, bindings, inconclusive: [primitiveSupport(evaluation)] };
  }

  return {
    value: "true",
    goal,
    bindings,
    positive: [
      primitiveSupport({
        operation: goal.kind,
        operands: [left, right],
        value: "true",
        result: value,
        results: [[variable, value]],
        ...primitiveRangeForExact(value),
      }),
    ],
  };
}

function primitiveComparisonJudgment(
  goal: ComparisonGoal<"eq" | "neq" | "lt" | "lte" | "gt" | "gte">,
  value: GoalValue,
  bindings: Bindings,
  left: unknown,
  leftExpression: GoalExpression,
  right: unknown,
  rightExpression: GoalExpression,
): Judgment<typeof goal> {
  const support = primitiveSupport({
    operation: goal.kind,
    operands: [publicOperand(left, leftExpression), publicOperand(right, rightExpression)],
    value,
    ...(isNumericRangeValue(left) ? { range: { lower: left.lower, upper: left.upper } } : {}),
    ...(isNumericRangeValue(right) ? { range: { lower: right.lower, upper: right.upper } } : {}),
    ...primitiveUncertaintyForComparison(value, left, leftExpression, right, rightExpression),
  });
  assert(
    value === "unknown" || (left !== UNBOUND && right !== UNBOUND),
    "Resolved primitive comparison operands must be bound",
  );
  assert(
    value !== "unknown" ||
      left === UNBOUND ||
      right === UNBOUND ||
      isNumericRangeValue(left) ||
      isNumericRangeValue(right),
    "Unknown primitive comparison requires an unavailable operand",
  );

  switch (value) {
    case "true":
      return { value, goal, bindings, positive: [support] };
    case "false":
      return { value, goal, bindings, negative: [support] };
    case "unknown":
      return { value, goal, bindings, inconclusive: [support] };
    case "conflicted":
      return { value, goal, bindings, positive: [support], negative: [support] };
    default:
      return assertNever(value, "Unhandled primitive comparison value");
  }
}

function primitiveSupport(evaluation: PrimitiveEvaluation): {
  source: "primitive";
  evaluation: PrimitiveEvaluation;
} {
  return { source: "primitive" as const, evaluation };
}

function publicOperand(value: unknown, expression: GoalExpression): unknown {
  return value === UNBOUND ? missingBinding(expression) : value;
}

function missingBinding(expression: GoalExpression): MissingBinding {
  assert(isVar(expression), "Only variables can have missing bindings");
  return { kind: "missing-binding", variable: expression };
}

function missingBindingUncertainty(
  left: unknown,
  leftExpression: GoalExpression,
  right: unknown,
  rightExpression: GoalExpression,
): readonly MissingBinding[] {
  return [
    ...(left === UNBOUND ? [missingBinding(leftExpression)] : []),
    ...(right === UNBOUND ? [missingBinding(rightExpression)] : []),
  ];
}

function primitiveUncertaintyForComparison(
  value: GoalValue,
  left: unknown,
  leftExpression: GoalExpression,
  right: unknown,
  rightExpression: GoalExpression,
): Partial<PrimitiveEvaluation> {
  if (left === UNBOUND || right === UNBOUND) {
    return { uncertainty: missingBindingUncertainty(left, leftExpression, right, rightExpression) };
  }
  if (value === "true" || value === "false") {
    return {};
  }
  if (isNumericRangeValue(left)) {
    return { uncertainty: comparisonUncertainty(value, left) };
  }
  if (isNumericRangeValue(right)) {
    return { uncertainty: comparisonUncertainty(value, right) };
  }
  return {};
}

function primitiveRangeForExact(value: unknown): Partial<PrimitiveEvaluation> {
  if (typeof value !== "number") {
    return {};
  }
  return { range: { lower: value, upper: value } };
}

// Type guards. Formula guards use `is<Kind>Formula`; structural shape guards use `is<Shape>Like`.
type ArithmeticFormula = Readonly<{
  kind: ArithmeticKind;
  args: readonly [unknown, unknown];
}>;

type ComparisonFormula = Readonly<{
  kind: "eq" | "neq" | "lt" | "lte" | "gt" | "gte";
  args: readonly [unknown, unknown];
}>;

type LetInFormula = Readonly<{
  kind: "letIn";
  args: readonly [unknown, unknown, unknown];
}>;

type AggregateFormula = Readonly<{
  kind: "sum" | "count";
  args:
    | readonly [unknown, unknown]
    | readonly [unknown, unknown, Readonly<{ completeWhen?: unknown }>];
}>;

function isArithmeticFormula(value: unknown): value is ArithmeticFormula {
  return (
    isFormula(value) &&
    ARITHMETIC_KINDS.some((kind) => kind === value.kind) &&
    value.args.length === 2
  );
}

function isComparisonFormula(value: unknown): value is ComparisonFormula {
  return (
    isFormula(value) &&
    ["eq", "neq", "lt", "lte", "gt", "gte"].includes(value.kind) &&
    value.args.length === 2
  );
}

function isLetInFormula(value: unknown): value is LetInFormula {
  return isFormula(value, "letIn") && value.args.length === 3;
}

function isAggregateFormula(value: unknown): value is AggregateFormula {
  return (
    isFormula(value) &&
    (value.kind === "sum" || value.kind === "count") &&
    (value.args.length === 2 || value.args.length === 3)
  );
}

function isLiteralLike(value: unknown): value is AnyLiteral {
  return (
    typeof value === "object" &&
    value !== null &&
    "sign" in value &&
    (value.sign === "+" || value.sign === "-") &&
    "atom" in value &&
    isAtomLike(value.atom)
  );
}

function calculateValue(
  kind: ArithmeticKind,
  left: SolverValue,
  right: SolverValue,
  goal: ArithmeticGoal<ArithmeticKind>,
): SolverValue {
  if (left === UNBOUND || right === UNBOUND) {
    return UNBOUND;
  }

  if (left instanceof Date && right instanceof Date) {
    if (kind === "daysBetween") {
      return daysBetween(left, right);
    }
    if (kind === "yearsBetween") {
      return yearsBetween(left, right);
    }
  }

  if (left instanceof Date && typeof right === "number" && kind === "sub") {
    return new Date(left.getTime() - right);
  }

  if (typeof left === "number" && typeof right === "number") {
    switch (kind) {
      case "add":
        return left + right;
      case "sub":
        return left - right;
      case "mul":
        return left * right;
      case "div":
        return left / right;
      case "daysBetween":
      case "yearsBetween":
        break;
      case "min":
        return Math.min(left, right);
      case "max":
        return Math.max(left, right);
      case "roundTo":
      case "floorTo":
      case "ceilTo":
        if (!Number.isInteger(right)) {
          throw new PrimitiveArithmeticProgrammerError(kind, [left, right], goal);
        }
        return roundAtPlaces(left, right, kind);
      default:
        return assertNever(kind, "Unhandled arithmetic kind");
    }
  }

  throw new PrimitiveArithmeticProgrammerError(kind, [left, right], goal);
}

/**
 * Shift the shortest decimal representation, avoiding multiplication artifacts
 * at decimal boundaries (1.005 becomes 100.5, not 100.49999999999999).
 * Earlier arithmetic and the final conversion still use number precision.
 */
function shiftDecimal(value: number, places: number): number {
  if (value === 0 || !Number.isFinite(value)) {
    return value;
  }
  const [coefficient, exponent = "0"] = String(value).split("e");
  const shiftedExponent = Number(exponent) + places;
  if (shiftedExponent > 308) {
    return Math.sign(value) * Infinity;
  }
  if (shiftedExponent < -324) {
    return Math.sign(value) * 0;
  }
  return Number(`${coefficient}e${shiftedExponent}`);
}

function roundAtPlaces(
  value: number,
  places: number,
  kind: "roundTo" | "floorTo" | "ceilTo",
): number {
  if (value === 0 || !Number.isFinite(value)) {
    return value;
  }
  let shifted = shiftDecimal(value, places);
  // A finer scale than number can represent cannot change the original value.
  if (!Number.isFinite(shifted)) {
    return value;
  }
  // Preserve direction if a very coarse scale underflows a nonzero operand.
  if (shifted === 0) {
    shifted = Math.sign(value) * Number.MIN_VALUE;
  }
  let rounded: number;
  switch (kind) {
    case "roundTo":
      rounded = Math.sign(shifted) * Math.round(Math.abs(shifted));
      break;
    case "floorTo":
      rounded = Math.floor(shifted);
      break;
    case "ceilTo":
      rounded = Math.ceil(shifted);
      break;
    default:
      return assertNever(kind, "Unhandled rounding kind");
  }
  return shiftDecimal(rounded, -places);
}

function compareValues(
  kind: "eq" | "neq" | "lt" | "lte" | "gt" | "gte",
  left: SolverValue,
  right: SolverValue,
): GoalValue {
  assert(left !== UNBOUND && right !== UNBOUND, "Comparison operands must be bound");

  if (isNumericRangeValue(left) && typeof right === "number") {
    return compareRangeToNumber(kind, left, right);
  }
  if (typeof left === "number" && isNumericRangeValue(right)) {
    return compareNumberToRange(kind, left, right);
  }

  const leftComparable = left instanceof Date ? left.getTime() : left;
  const rightComparable = right instanceof Date ? right.getTime() : right;

  switch (kind) {
    case "eq":
      return leftComparable === rightComparable ? "true" : "false";
    case "neq":
      return leftComparable === rightComparable ? "false" : "true";
    case "lt":
    case "lte":
    case "gt":
    case "gte":
      return compareOrderedValues(kind, leftComparable, rightComparable);
    default:
      return assertNever(kind, "Unhandled comparison kind");
  }
}

function compareOrderedValues(
  kind: "lt" | "lte" | "gt" | "gte",
  left: DefinedValue,
  right: DefinedValue,
): GoalValue {
  assert(typeof left === "number" && typeof right === "number", "Values must be comparable");

  switch (kind) {
    case "lt":
      return left < right ? "true" : "false";
    case "lte":
      return left <= right ? "true" : "false";
    case "gt":
      return left > right ? "true" : "false";
    case "gte":
      return left >= right ? "true" : "false";
    default:
      return assertNever(kind, "Unhandled ordered comparison kind");
  }
}

function compareRangeToNumber(
  kind: "eq" | "neq" | "lt" | "lte" | "gt" | "gte",
  range: NumericRangeValue,
  threshold: number,
): GoalValue {
  switch (kind) {
    case "gte":
      if (range.lower >= threshold) {
        return "true";
      }
      if (range.upper !== "infinity" && range.upper < threshold) {
        return "false";
      }
      return intervalUncertaintyValue(kind, range, threshold);
    case "gt":
      if (range.lower > threshold) {
        return "true";
      }
      if (range.upper !== "infinity" && range.upper <= threshold) {
        return "false";
      }
      return intervalUncertaintyValue(kind, range, threshold);
    case "lte":
      if (range.upper !== "infinity" && range.upper <= threshold) {
        return "true";
      }
      if (range.lower > threshold) {
        return "false";
      }
      return intervalUncertaintyValue(kind, range, threshold);
    case "lt":
      if (range.upper !== "infinity" && range.upper < threshold) {
        return "true";
      }
      if (range.lower >= threshold) {
        return "false";
      }
      return intervalUncertaintyValue(kind, range, threshold);
    case "eq":
    case "neq":
      return range.upper !== "infinity" && range.lower === range.upper
        ? compareValues(kind, range.lower, threshold)
        : intervalUncertaintyValue(kind, range, threshold);
    default:
      return assertNever(kind, "Unhandled range comparison kind");
  }
}

function compareNumberToRange(
  kind: "eq" | "neq" | "lt" | "lte" | "gt" | "gte",
  value: number,
  range: NumericRangeValue,
): GoalValue {
  switch (kind) {
    case "gte":
      return compareRangeToNumber("lte", range, value);
    case "gt":
      return compareRangeToNumber("lt", range, value);
    case "lte":
      return compareRangeToNumber("gte", range, value);
    case "lt":
      return compareRangeToNumber("gt", range, value);
    case "eq":
    case "neq":
      return compareRangeToNumber(kind, range, value);
    default:
      return assertNever(kind, "Unhandled number-to-range comparison kind");
  }
}

function intervalUncertaintyValue(
  kind: "eq" | "neq" | "lt" | "lte" | "gt" | "gte",
  range: NumericRangeValue,
  threshold: number,
): "unknown" | "conflicted" {
  return conflictCanDecide(kind, range, threshold) ? "conflicted" : "unknown";
}

function conflictCanDecide(
  kind: "eq" | "neq" | "lt" | "lte" | "gt" | "gte",
  range: NumericRangeValue,
  threshold: number,
): boolean {
  const conflicted = range.uncertainty.find((item) => item.kind === "conflict")?.count ?? 0;
  if (conflicted === 0) {
    return false;
  }
  const conflictUpper = range.lower + conflicted;

  switch (kind) {
    case "gte":
      return range.lower < threshold && threshold <= conflictUpper;
    case "gt":
      return range.lower <= threshold && threshold < conflictUpper;
    case "lte":
      return range.lower <= threshold && threshold < conflictUpper;
    case "lt":
      return range.lower < threshold && threshold <= conflictUpper;
    case "eq":
    case "neq":
      return range.lower <= threshold && threshold <= conflictUpper;
    default:
      return assertNever(kind, "Unhandled conflict range comparison kind");
  }
}

function comparisonUncertainty(
  value: GoalValue,
  range: NumericRangeValue,
): readonly CountUncertainty[] {
  if (value === "conflicted") {
    return range.uncertainty.filter((item) => item.kind === "conflict");
  }
  if (value === "unknown") {
    return range.uncertainty.filter((item) => item.kind !== "conflict");
  }
  return [];
}

function isNumericRangeValue(value: unknown): value is NumericRangeValue {
  return (
    typeof value === "object" && value !== null && "kind" in value && value.kind === "numeric-range"
  );
}

/** Select the branch with the highest GoalValue rank: false < unknown < conflicted < true. */
function bestResult(results: readonly BodyResult[]): BodyResult | undefined {
  return results.reduce<BodyResult | undefined>((best, result) => {
    if (best === undefined) {
      return result;
    }
    return maxGoalValue(best.judgment.value, result.judgment.value) === result.judgment.value
      ? result
      : best;
  }, undefined);
}

function extendBindings(
  pattern: Atom,
  atom: GroundAtom,
  bindings: ReadonlyMap<Var, unknown>,
): ReadonlyMap<Var, unknown> | undefined {
  const matched = matchPattern(pattern, atom);
  if (matched === undefined) {
    return undefined;
  }

  const next = new Map(bindings);
  for (const [variable, value] of matched) {
    if (next.has(variable) && !fieldEquals(next.get(variable), value)) {
      return undefined;
    }
    next.set(variable, value);
  }

  return next;
}

function compoundJudgment(
  goal: AndGoal | OrGoal,
  value: GoalValue,
  bindings: Bindings,
  judgments: readonly Judgment[],
): Judgment<AndGoal | OrGoal> {
  const support = { source: "subgoals" as const, judgments };

  switch (value) {
    case "true":
      return { value, goal, bindings, positive: [support] };
    case "false":
      return { value, goal, bindings, negative: [support] };
    case "conflicted":
      return { value, goal, bindings, positive: [support], negative: [support] };
    case "unknown":
      return { value, goal, bindings, inconclusive: [support] };
    default:
      return assertNever(value, "Unhandled compound goal value");
  }
}

function compoundExistsJudgment(
  goal: ExistsGoal,
  value: GoalValue,
  bindings: Bindings,
  judgments: readonly Judgment[],
): Judgment<ExistsGoal> {
  const support = { source: "subgoals" as const, judgments };

  switch (value) {
    case "true":
      return { value, goal, bindings, positive: [support] };
    case "false":
      return { value, goal, bindings, negative: [support] };
    case "conflicted":
      return { value, goal, bindings, positive: [support], negative: [support] };
    case "unknown":
      return { value, goal, bindings, inconclusive: [support] };
    default:
      return assertNever(value, "Unhandled exists goal value");
  }
}

function withBindings<GoalType extends Goal>(
  judgment: Judgment<GoalType>,
  bindings: Bindings,
): Judgment<GoalType> {
  return { ...judgment, bindings };
}

function ruleContribution(kind: "if" | "iff", value: GoalValue): GoalValue {
  return kind === "if" && value === "false" ? "unknown" : value;
}

function bindingsArray(bindings: ReadonlyMap<Var, unknown>): Bindings {
  return [...bindings.entries()];
}

/**
 * The temporaries arithmetic introduces for its intermediate results. They record the
 * computation in the proof tree but are not rule variables, so two environments that
 * differ only in temporaries are the same environment, and a result that adds only
 * temporaries binds nothing beyond the environment it was evaluated in.
 */
const TEMPORARY_PREFIX = "$tmp";

function isTemporary(variable: Var): boolean {
  return variable.name.startsWith(TEMPORARY_PREFIX);
}

/** Whether the result binds a rule variable the environment does not. */
function bindsBeyond(
  result: ReadonlyMap<Var, unknown>,
  environment: ReadonlyMap<Var, unknown>,
): boolean {
  for (const variable of result.keys()) {
    if (!isTemporary(variable) && !environment.has(variable)) {
      return true;
    }
  }
  return false;
}

/** A key identifying a binding environment by its non-temporary variables' values. */
function bindingsKey(binding: ReadonlyMap<Var, unknown>): string {
  return JSON.stringify(
    bindingsArray(binding)
      .filter(([variable]) => !isTemporary(variable))
      .map(([variable, value]) => [variable.name, fieldIdentityToken(value)]),
  );
}

function uniqueBindings(
  bindings: readonly ReadonlyMap<Var, unknown>[],
): readonly ReadonlyMap<Var, unknown>[] {
  const seen = new Set<string>();
  const unique: ReadonlyMap<Var, unknown>[] = [];

  for (const binding of bindings) {
    const key = bindingsKey(binding);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(binding);
    }
  }

  return unique;
}

function canGroundAtom(atom: Atom, bindings: ReadonlyMap<Var, unknown>): boolean {
  return Object.values(atom.fields).every((value) => !isVar(value) || bindings.has(value));
}

function groundAtomKey(atom: GroundAtom, search: SearchContext): string {
  const fields = atom.predicate.paramNames.map((name) => fieldIdentityToken(atom.fields[name]));
  return `${search.index.predicateId(atom.predicate)}:${JSON.stringify(fields)}`;
}

function candidateGroundAtoms<Schema extends PredicateSchema>(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  atom: Atom<Schema>,
  active: ActiveAtoms,
  search: SearchContext,
  pathCanHaveUnavailableBindings = false,
): GroundAtom<Schema>[] {
  return search.candidates
    .candidates(atom, matchingGroundAtoms(search.index.literalsFor(atom.predicate), atom), () =>
      deriveCandidateAtoms(literals, rules, atom, active, search, pathCanHaveUnavailableBindings),
    )
    .filter((candidate): candidate is GroundAtom<Schema> =>
      isAtomForPredicate(candidate, atom.predicate),
    );
}

/**
 * Enumerate the ground atoms a pattern's rules can derive. On a path where an earlier
 * conjunct already failed and left a pattern variable unbound, the rule bodies are
 * evaluated tolerantly: a comparison on that variable is unknown rather than a programmer
 * error, and a head it leaves unground yields no candidate.
 */
function deriveCandidateAtoms<Schema extends PredicateSchema>(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  atom: Atom<Schema>,
  active: ActiveAtoms,
  search: SearchContext,
  pathCanHaveUnavailableBindings = false,
): GroundAtom<Schema>[] {
  const atoms: GroundAtom<Schema>[] = [];
  for (const rule of search.index.rulesFor(atom.predicate)) {
    const ruleHead = atomForPredicate(rule.head.atom, atom.predicate);
    if (ruleHead === undefined) {
      continue;
    }

    const bindings = matchRuleHeadToQuery(ruleHead, atom);
    if (bindings === undefined) {
      continue;
    }

    const context: EvaluationContext = { nextTemp: 0, search, candidatePredicate: atom.predicate };
    const bodies = evaluateRuleBodyMany(
      literals,
      rules,
      rule.body,
      bindings,
      active,
      context,
      pathCanHaveUnavailableBindings,
    );
    for (const body of bodies) {
      // A false body cannot introduce a candidate. Recursive atoms in the component
      // being discovered are unknown placeholders, not closed-world false; evidence
      // seeds and candidates supported by other rule bodies remain available.
      if (body.judgment.value === "false" || !canGroundAtom(ruleHead, body.bindings)) {
        continue;
      }

      const candidate = groundAtom(ruleHead, body.bindings);
      if (
        !matchesAtom(candidate, atom) ||
        atoms.some((existing) => atomEquals(existing, candidate))
      ) {
        continue;
      }

      atoms.push(candidate);
    }
  }

  return atoms;
}

function matchRuleHeadToQuery(ruleHead: Atom, query: Atom): ReadonlyMap<Var, unknown> | undefined {
  if (ruleHead.predicate !== query.predicate) {
    return undefined;
  }

  const bindings = new Map<Var, unknown>();
  for (const [name, ruleValue] of Object.entries(ruleHead.fields)) {
    const queryValue = query.fields[name];
    if (isVar(queryValue)) {
      continue;
    }

    if (isVar(ruleValue)) {
      const boundValue = bindings.get(ruleValue);
      if (bindings.has(ruleValue) && !fieldEquals(boundValue, queryValue)) {
        return undefined;
      }
      bindings.set(ruleValue, queryValue);
      continue;
    }

    if (!fieldEquals(ruleValue, queryValue)) {
      return undefined;
    }
  }

  return bindings;
}

function matchingGroundAtoms<Schema extends PredicateSchema>(
  literals: readonly AnyLiteral[],
  atom: Atom<Schema>,
): GroundAtom<Schema>[] {
  const atoms: GroundAtom<Schema>[] = [];

  for (const literal of literals) {
    const literalAtom = atomForPredicate(literal.atom, atom.predicate);
    if (literalAtom === undefined || !isGroundAtom(literalAtom)) {
      continue;
    }

    if (!matchesAtom(literalAtom, atom)) {
      continue;
    }

    if (atoms.some((candidate) => atomEquals(candidate, literalAtom))) {
      continue;
    }

    atoms.push(literalAtom);
  }

  return atoms;
}

function matchesAtom<Schema extends PredicateSchema>(
  candidate: GroundAtom<Schema>,
  atom: Atom<Schema>,
): candidate is GroundAtom<Schema> {
  return matchPattern(atom, candidate) !== undefined;
}

function matchingLiterals<Schema extends PredicateSchema>(
  literals: readonly AnyLiteral[],
  atom: GroundAtom<Schema>,
  sign: "+" | "-",
): Literal<Schema>[] {
  return literals.filter((literal): literal is Literal<Schema> => {
    const literalAtom = atomForPredicate(literal.atom, atom.predicate);
    return literal.sign === sign && literalAtom !== undefined && atomEquals(literalAtom, atom);
  });
}

function erasedAtom(atom: AnyAtom): Atom {
  return atom;
}

function atomForPredicate<Schema extends PredicateSchema>(
  atom: AnyAtom,
  predicate: PredicateDeclaration<Schema>,
): Atom<Schema> | undefined {
  if (!isAtomForPredicate(atom, predicate)) {
    return undefined;
  }
  return atom;
}
