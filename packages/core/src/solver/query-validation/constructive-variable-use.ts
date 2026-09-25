import { isAtomLike } from "../../types/atom";
import { UnsafeUnboundVariableProgrammerError } from "../../exceptions/programmer-errors";
import { isFormula } from "../../dsl/types";
import { isVar } from "../../types/variable";
import type { PredicateSchema } from "../../types/schema";
import type { Var } from "../../types/variable";
import type { QueryValidationContext } from "./context";
import {
  bindVariables,
  isAggregateFormula,
  isCompleteWhenOption,
  isNegativeLiteral,
  isPrimitiveFormula,
  reachablePredicates,
  ruleEdges,
  uniqueVariables,
  variablesIn,
} from "./utils";

export function assertConstructiveVariableUse<Schema extends PredicateSchema>(
  context: QueryValidationContext<Schema>,
): void {
  const edges = context.rules.flatMap(ruleEdges);
  const reachable = reachablePredicates(context.atom.predicate, edges);

  for (const rule of context.rules) {
    if (!reachable.has(rule.head.atom.predicate)) {
      continue;
    }

    assertSafeBody(rule.body, new Set(variablesIn(rule.head.atom)));
  }
}

function assertSafeBody(body: unknown, bound: Set<Var>): Set<Var> {
  if (isAtomLike(body)) {
    bindVariables(body, bound);
    return bound;
  }

  if (isNegativeLiteral(body)) {
    assertVariablesBound(variablesIn(body.atom), bound);
    return bound;
  }

  if (isFormula(body, "and")) {
    let nextBound = bound;
    for (const arg of body.args) {
      nextBound = assertSafeBody(arg, nextBound);
    }
    return nextBound;
  }

  if (isFormula(body, "or")) {
    return bindingsAvailableAfterOr(body.args, bound);
  }

  if (isFormula(body, "exists")) {
    const nextBody = body.args.at(-1);
    if (nextBody !== undefined) {
      assertSafeBody(nextBody, new Set(bound));
    }
    return bound;
  }

  if (isFormula(body, "letIn")) {
    const [variable, value, nextBody] = body.args;
    if (isAggregateFormula(value)) {
      assertSafeAggregate(value, bound);
    } else {
      assertVariablesBound(variablesIn(value), bound);
    }
    if (isVar(variable)) {
      bound.add(variable);
    }
    return assertSafeBody(nextBody, bound);
  }

  if (isPrimitiveFormula(body)) {
    assertVariablesBound(variablesIn(body), bound);
  }

  return bound;
}

function assertSafeAggregate(
  aggregate: Readonly<{ kind: string; args: readonly unknown[] }>,
  bound: ReadonlySet<Var>,
): void {
  const [value, whereBody, options] = aggregate.args;
  const rowBindings = assertSafeBody(whereBody, new Set(bound));
  if (aggregate.kind === "sum") {
    assertVariablesBound(variablesIn(value), rowBindings);
  }

  if (isCompleteWhenOption(options)) {
    assertSafeBody(options.completeWhen, new Set(bound));
  }
}

function bindingsAvailableAfterOr(args: readonly unknown[], bound: ReadonlySet<Var>): Set<Var> {
  const branchBindings = args.map((arg) => assertSafeBody(arg, new Set(bound)));
  const next = new Set(bound);

  for (const candidate of uniqueVariables(branchBindings.flatMap((branch) => [...branch]))) {
    if (branchBindings.length > 0 && branchBindings.every((branch) => branch.has(candidate))) {
      next.add(candidate);
    }
  }

  return next;
}

function assertVariablesBound(variables: readonly Var[], bound: ReadonlySet<Var>): void {
  const unbound = uniqueVariables(variables).filter((variable) => !bound.has(variable));
  if (unbound.length > 0) {
    throw new UnsafeUnboundVariableProgrammerError(unbound);
  }
}
