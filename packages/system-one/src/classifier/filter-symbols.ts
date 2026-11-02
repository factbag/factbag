import { type Entity, type Scalar, fieldEquals } from "factbag/dsl";
import type { Chunk } from "factbag/corpus";
import type { Pipeline } from "../pipeline";
import type { ClassifiablePredicate } from "./types";

/**
 * Shortlist the symbols relevant to one passage. This is the second pipeline step, after
 * predicate filtering. The shortlist is shared across all retained predicates and roles;
 * classification later intersects it with each role's domain, so order does not matter.
 */
export async function filterSymbols({
  chunk,
  predicates,
  config,
}: {
  chunk: Chunk;
  predicates: readonly ClassifiablePredicate[];
  config: Pipeline;
}): Promise<readonly (Scalar | Entity)[]> {
  const symbols = predicates
    /** Pool every role's domain into one passage-wide list. */
    .flatMap(({ roles }) => Object.values(roles).flat())
    /** Drop structural duplicates so each symbol is asked about at most once. */
    .filter((value, index, all) => all.findIndex((other) => fieldEquals(value, other)) === index);
  if (!needsFiltering(predicates, config)) {
    return symbols;
  }
  const answers = await config.model.relevance({
    text: chunk.text,
    /** Ask only about entities and scalars; a passage never "mentions" true or false. */
    subjects: symbols.filter((value) => typeof value !== "boolean").map((value) => ({ value })),
  });
  return [
    /** Keep both Boolean values unconditionally, so facts like f(x, false) still get classified. */
    ...symbols.filter((value) => typeof value === "boolean"),
    ...answers
      /** Keep entities and scalars the passage is relevant to with enough confidence. */
      .filter(({ relevance }) => relevance >= config.symbolThreshold)
      .map(({ subject }) => subject.value),
  ];
}

/**
 * Decide whether symbol routing is worth its requests for this passage. It is when routing
 * is enabled and at least one predicate would otherwise enumerate too many candidate facts
 * through a role that filtering can actually shrink.
 */
function needsFiltering(predicates: readonly ClassifiablePredicate[], config: Pipeline): boolean {
  return (
    config.routing &&
    predicates.some(
      (predicate) =>
        /** The full Cartesian product of role domains exceeds the cutoff. */
        Object.values(predicate.roles).reduce((total, domain) => total * domain.length, 1) >
          config.candidateProductCutoff &&
        /** Boolean roles are never filtered, so at least one role must be non-Boolean. */
        Object.keys(predicate.roles).some((role) => predicate.declaration.params[role] !== Boolean),
    )
  );
}
