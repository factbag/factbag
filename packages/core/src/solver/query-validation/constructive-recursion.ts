import { isAtomLike, isGroundAtom } from "../../types/atom";
import { UnconstructiveRecursionProgrammerError } from "../../exceptions/programmer-errors";
import { isFormula } from "../../dsl/types";
import type { PredicateDeclaration } from "../../types/predicate";
import type { AnyRule } from "../../types/rule";
import type { PredicateSchema } from "../../types/schema";
import type { QueryValidationContext } from "./context";
import {
  isNegativeLiteral,
  reachablePredicates,
  ruleEdges,
  stronglyConnectedComponents,
  variablesIn,
  type Edge,
} from "./utils";

export function assertConstructiveRecursion<Schema extends PredicateSchema>(
  context: QueryValidationContext<Schema>,
): void {
  const edges = context.rules.flatMap(ruleEdges);
  const reachable = reachablePredicates(context.atom.predicate, edges);
  const components = componentsAmong(reachable, edges);
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

/** The components among the given predicates, each once. */
function componentsAmong(
  predicates: ReadonlySet<PredicateDeclaration>,
  edges: readonly Edge[],
): Array<Set<PredicateDeclaration>> {
  const byPredicate = stronglyConnectedComponents(edges);
  const seen = new Set<ReadonlySet<PredicateDeclaration>>();
  const components: Array<Set<PredicateDeclaration>> = [];
  for (const predicate of predicates) {
    const component = byPredicate.get(predicate) ?? new Set([predicate]);
    if (!seen.has(component)) {
      seen.add(component);
      components.push(new Set(component));
    }
  }
  return components;
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
