import { isAtomLike } from "../../types/atom";
import { isFormula } from "../../dsl/types";
import type { AnyLiteral } from "../../types/literal";
import type { PredicateDeclaration } from "../../types/predicate";
import type { AnyRule } from "../../types/rule";
import { isVar } from "../../types/variable";
import type { Var } from "../../types/variable";

type EdgeKind =
  | "positive"
  | "explicit-not"
  | "closed-world-not"
  | "aggregate"
  | "primitive-ungrounded";

export type Edge = Readonly<{
  from: PredicateDeclaration;
  to: PredicateDeclaration;
  kind: EdgeKind;
}>;

export function ruleEdges(rule: AnyRule): Edge[] {
  const headPredicate = rule.head.atom.predicate;
  const headBindings = variablesIn(rule.head.atom);
  const edges: Edge[] = [];

  collectBodyEdges(rule.body, headPredicate, new Set(headBindings), edges);
  return edges;
}

export function reachablePredicates(
  start: PredicateDeclaration,
  edges: readonly Edge[],
): Set<PredicateDeclaration> {
  const next = adjacency(edges);
  const reachable = new Set<PredicateDeclaration>([start]);
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }

    for (const target of next.get(current) ?? []) {
      if (reachable.has(target)) {
        continue;
      }
      reachable.add(target);
      stack.push(target);
    }
  }

  return reachable;
}

function adjacency(
  edges: readonly Edge[],
): ReadonlyMap<PredicateDeclaration, ReadonlySet<PredicateDeclaration>> {
  const next = new Map<PredicateDeclaration, Set<PredicateDeclaration>>();
  for (const { from, to } of edges) {
    let targets = next.get(from);
    if (targets === undefined) {
      targets = new Set();
      next.set(from, targets);
    }
    targets.add(to);
  }
  return next;
}

/** Linear-time Tarjan components, including predicates that occur only as targets. */
export function stronglyConnectedComponents(
  edges: readonly Edge[],
): ReadonlyMap<PredicateDeclaration, ReadonlySet<PredicateDeclaration>> {
  const next = adjacency(edges);
  const indices = new Map<PredicateDeclaration, number>();
  const onStack = new Set<PredicateDeclaration>();
  const stack: PredicateDeclaration[] = [];
  const components = new Map<PredicateDeclaration, ReadonlySet<PredicateDeclaration>>();

  // Plain recursion is sufficient for the expected graphs of a few hundred predicates.
  function visit(predicate: PredicateDeclaration): number {
    const index = indices.size;
    indices.set(predicate, index);
    let lowLink = index;
    stack.push(predicate);
    onStack.add(predicate);
    for (const target of next.get(predicate) ?? []) {
      const targetIndex = indices.get(target);
      if (targetIndex === undefined) {
        const targetLowLink = visit(target);
        lowLink = Math.min(lowLink, targetLowLink);
      } else if (onStack.has(target)) {
        lowLink = Math.min(lowLink, targetIndex);
      }
    }
    if (lowLink === index) {
      const component = new Set<PredicateDeclaration>();
      for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
        onStack.delete(member);
        component.add(member);
        if (member === predicate) {
          break;
        }
      }
      for (const member of component) {
        components.set(member, component);
      }
    }
    return lowLink;
  }

  for (const predicate of next.keys()) {
    if (!indices.has(predicate)) {
      visit(predicate);
    }
  }
  return components;
}

export function isNegativeLiteral(value: unknown): value is AnyLiteral & { sign: "-" } {
  return (
    typeof value === "object" &&
    value !== null &&
    "sign" in value &&
    value.sign === "-" &&
    "atom" in value &&
    isAtomLike(value.atom)
  );
}

export function isAggregateFormula(value: unknown): value is Readonly<{
  kind: "sum" | "count";
  args: readonly unknown[];
}> {
  return isFormula(value) && (value.kind === "sum" || value.kind === "count");
}

export function isCompleteWhenOption(value: unknown): value is Readonly<{ completeWhen: unknown }> {
  return typeof value === "object" && value !== null && "completeWhen" in value;
}

export function isPrimitiveFormula(value: unknown): boolean {
  return (
    isFormula(value) &&
    ["add", "sub", "mul", "div", "eq", "neq", "lt", "lte", "gt", "gte"].includes(value.kind)
  );
}

export function bindVariables(value: unknown, bound: Set<Var>): void {
  for (const variable of variablesIn(value)) {
    bound.add(variable);
  }
}

function hasUnboundVariable(value: unknown, bound: ReadonlySet<Var>): boolean {
  return variablesIn(value).some((variable) => !bound.has(variable));
}

export function uniqueVariables(variables: readonly Var[]): Var[] {
  const seen = new Set<Var>();
  const unique: Var[] = [];

  for (const variable of variables) {
    if (!seen.has(variable)) {
      seen.add(variable);
      unique.push(variable);
    }
  }

  return unique;
}

/** Bindings available after an `or`: those held before it plus those every branch makes. */
export function bindingsAfterOr(
  branchBindings: readonly ReadonlySet<Var>[],
  bound: ReadonlySet<Var>,
): Set<Var> {
  const next = new Set(bound);
  for (const candidate of uniqueVariables(branchBindings.flatMap((branch) => [...branch]))) {
    if (branchBindings.every((branch) => branch.has(candidate))) {
      next.add(candidate);
    }
  }
  return next;
}

export function variablesIn(value: unknown): Var[] {
  if (isVar(value)) {
    return [value];
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  if (value instanceof Date) {
    return [];
  }

  return Object.values(value).flatMap(variablesIn);
}

/**
 * Record the rule edges a body contributes and return the bindings available after
 * it. Binding rules mirror the variable-use checker: an `and` threads bindings
 * through its conjuncts, an `or` keeps only what every branch binds, and an
 * `exists` keeps its bindings to itself.
 */
function collectBodyEdges(
  body: unknown,
  headPredicate: PredicateDeclaration,
  bound: Set<Var>,
  edges: Edge[],
): Set<Var> {
  if (isAtomLike(body)) {
    edges.push({ from: headPredicate, to: body.predicate, kind: "positive" });
    bindVariables(body, bound);
    return bound;
  }

  if (isNegativeLiteral(body)) {
    edges.push({
      from: headPredicate,
      to: body.atom.predicate,
      kind: body.atom.predicate.world === "closed" ? "closed-world-not" : "explicit-not",
    });
    return bound;
  }

  if (isFormula(body, "and")) {
    let nextBound = bound;
    for (const arg of body.args) {
      nextBound = collectBodyEdges(arg, headPredicate, nextBound, edges);
    }
    return nextBound;
  }

  if (isFormula(body, "or")) {
    const branchBindings = body.args.map((arg) =>
      collectBodyEdges(arg, headPredicate, new Set(bound), edges),
    );
    return bindingsAfterOr(branchBindings, bound);
  }

  if (isFormula(body, "exists")) {
    for (const arg of body.args) {
      collectBodyEdges(arg, headPredicate, new Set(bound), edges);
    }
    return bound;
  }

  if (isFormula(body, "letIn")) {
    const [variable, value, nextBody] = body.args;
    if (isAggregateFormula(value)) {
      collectAggregateEdges(value, headPredicate, bound, edges);
    } else if (hasUnboundVariable(value, bound)) {
      edges.push({ from: headPredicate, to: headPredicate, kind: "primitive-ungrounded" });
    }
    if (isVar(variable)) {
      bound.add(variable);
    }
    return collectBodyEdges(nextBody, headPredicate, bound, edges);
  }

  if (isPrimitiveFormula(body) && hasUnboundVariable(body, bound)) {
    edges.push({ from: headPredicate, to: headPredicate, kind: "primitive-ungrounded" });
  }

  return bound;
}

function collectAggregateEdges(
  aggregate: Readonly<{ args: readonly unknown[] }>,
  headPredicate: PredicateDeclaration,
  bound: Set<Var>,
  edges: Edge[],
): void {
  for (const arg of aggregate.args.slice(1)) {
    collectBodyEdgesWithKind(arg, headPredicate, bound, edges, "aggregate");
  }
}

function collectBodyEdgesWithKind(
  body: unknown,
  headPredicate: PredicateDeclaration,
  bound: Set<Var>,
  edges: Edge[],
  kind: EdgeKind,
): void {
  if (isAtomLike(body)) {
    edges.push({ from: headPredicate, to: body.predicate, kind });
    bindVariables(body, bound);
    return;
  }

  if (isNegativeLiteral(body)) {
    edges.push({ from: headPredicate, to: body.atom.predicate, kind });
    bindVariables(body.atom, bound);
    return;
  }

  if (isFormula(body)) {
    for (const arg of body.args) {
      collectBodyEdgesWithKind(arg, headPredicate, bound, edges, kind);
    }
  }
}
