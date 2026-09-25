import { isAtomLike, isGroundAtom } from "../../types/atom";
import { UnconstructiveRecursionProgrammerError } from "../../exceptions/programmer-errors";
import { isFormula } from "../../dsl/types";
import type { PredicateDeclaration } from "../../types/predicate";
import type { AnyRule } from "../../types/rule";
import type { PredicateSchema } from "../../types/schema";
import type { QueryValidationContext } from "./context";
import { isNegativeLiteral, reachablePredicates, ruleEdges, variablesIn, type Edge } from "./utils";

export function assertConstructiveRecursion<Schema extends PredicateSchema>(
  context: QueryValidationContext<Schema>,
): void {
  const edges = context.rules.flatMap(ruleEdges);
  const reachable = reachablePredicates(context.atom.predicate, edges);
  const components = stronglyConnectedComponents(reachable, edges);
  const needsCandidateEnumeration = variablesIn(context.atom).length > 0;

  for (const component of components) {
    const internalEdges = edges.filter(
      (edge) => component.has(edge.from) && component.has(edge.to),
    );
    const recursive = component.size > 1 || internalEdges.some((edge) => edge.from === edge.to);
    if (!recursive) {
      continue;
    }

    if (internalEdges.some((edge) => edge.kind !== "positive")) {
      throw new UnconstructiveRecursionProgrammerError();
    }

    const hasGroundEvidence = context.literals.some(
      (literal) => component.has(literal.atom.predicate) && isGroundAtom(literal.atom),
    );
    if (
      needsCandidateEnumeration &&
      !hasGroundEvidence &&
      !hasNonRecursiveBaseRule(component, context.rules)
    ) {
      throw new UnconstructiveRecursionProgrammerError();
    }
  }
}

function hasNonRecursiveBaseRule(
  component: ReadonlySet<PredicateDeclaration>,
  rules: readonly AnyRule[],
): boolean {
  return rules.some(
    (rule) =>
      component.has(rule.head.atom.predicate) && !bodyReferencesPredicates(rule.body, component),
  );
}

function stronglyConnectedComponents(
  predicates: ReadonlySet<PredicateDeclaration>,
  edges: readonly Edge[],
): Array<Set<PredicateDeclaration>> {
  const components: Array<Set<PredicateDeclaration>> = [];
  const remaining = new Set(predicates);

  for (const predicate of predicates) {
    if (!remaining.has(predicate)) {
      continue;
    }

    const forward = reachablePredicates(predicate, edges);
    const backward = reachablePredicates(predicate, reverseEdges(edges));
    const component = new Set<PredicateDeclaration>();
    for (const candidate of predicates) {
      if (forward.has(candidate) && backward.has(candidate)) {
        component.add(candidate);
        remaining.delete(candidate);
      }
    }
    components.push(component);
  }

  return components;
}

function reverseEdges(edges: readonly Edge[]): Edge[] {
  return edges.map((edge) => ({ ...edge, from: edge.to, to: edge.from }));
}

function bodyReferencesPredicates(
  body: unknown,
  predicates: ReadonlySet<PredicateDeclaration>,
): boolean {
  if (isAtomLike(body)) {
    return predicates.has(body.predicate);
  }

  if (isNegativeLiteral(body)) {
    return predicates.has(body.atom.predicate);
  }

  if (isFormula(body)) {
    return body.args.some((arg) => bodyReferencesPredicates(arg, predicates));
  }

  return false;
}
