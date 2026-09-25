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
  const reachable = new Set<PredicateDeclaration>([start]);
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }

    for (const edge of edges) {
      if (edge.from !== current || reachable.has(edge.to)) {
        continue;
      }
      reachable.add(edge.to);
      stack.push(edge.to);
    }
  }

  return reachable;
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

function collectBodyEdges(
  body: unknown,
  headPredicate: PredicateDeclaration,
  bound: Set<Var>,
  edges: Edge[],
): void {
  if (isAtomLike(body)) {
    edges.push({ from: headPredicate, to: body.predicate, kind: "positive" });
    bindVariables(body, bound);
    return;
  }

  if (isNegativeLiteral(body)) {
    edges.push({
      from: headPredicate,
      to: body.atom.predicate,
      kind: body.atom.predicate.world === "closed" ? "closed-world-not" : "explicit-not",
    });
    bindVariables(body.atom, bound);
    return;
  }

  if (isFormula(body, "and")) {
    for (const arg of body.args) {
      collectBodyEdges(arg, headPredicate, bound, edges);
    }
    return;
  }

  if (isFormula(body, "or") || isFormula(body, "exists")) {
    for (const arg of body.args) {
      collectBodyEdges(arg, headPredicate, new Set(bound), edges);
    }
    return;
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
    collectBodyEdges(nextBody, headPredicate, bound, edges);
    return;
  }

  if (isPrimitiveFormula(body) && hasUnboundVariable(body, bound)) {
    edges.push({ from: headPredicate, to: headPredicate, kind: "primitive-ungrounded" });
  }
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
