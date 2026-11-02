import { fieldEquals } from "@factbag/core/dsl";
import type { Entity, PredicateDeclaration, Scalar } from "@factbag/core/dsl";
import type { Chunk } from "@factbag/corpus";
import { isEntity } from "../utils";
import type { ClassifiablePredicate, CreateChunkSymbolExtractor, SymbolAnswer } from "./types";

/**
 * Widen each retained predicate's open fields with the values this chunk offers. This is
 * the second pipeline step, after predicate filtering, so only fields of predicates the
 * passage may bear on are queried. A predicate left with an empty field has no candidate
 * facts, so it is dropped before symbol filtering can spend a request on it. Boolean and
 * enumeration fields keep their declared domains; entity fields keep their registered
 * entities. Extracted entities are only candidates: nothing is registered here.
 */
export async function extractSymbols({
  chunk,
  predicates,
  createExtractor,
}: {
  chunk: Chunk;
  predicates: readonly ClassifiablePredicate[];
  createExtractor: CreateChunkSymbolExtractor | undefined;
}): Promise<readonly ClassifiablePredicate[]> {
  const requests = new Map(
    predicates
      .map(({ declaration }) => [declaration, openFields(declaration)] as const)
      .filter(([, fields]) => fields.length > 0),
  );
  /** Nothing to ask builds no extractor. */
  if (createExtractor === undefined || requests.size === 0) {
    return predicates;
  }
  const answer = await createExtractor([chunk]).query(requests);
  assertAnswers(requests, answer);
  return (
    predicates
      .map((predicate) => ({
        ...predicate,
        roles: Object.fromEntries(
          Object.entries(predicate.roles).map(([name, domain]) => [
            name,
            unique([...domain, ...(answer.get(predicate.declaration)?.[name] ?? [])]),
          ]),
        ),
      }))
      /** A field with no values leaves no candidate facts to ask about. */
      .filter(({ roles }) => Object.values(roles).every((domain) => domain.length > 0))
  );
}

/** The fields whose values come from the passage: every field but Boolean and enumeration ones. */
function openFields(predicate: PredicateDeclaration): readonly string[] {
  return predicate.paramNames.filter((name) => {
    const type = predicate.params[name];
    return typeof type === "function" && type !== Boolean;
  });
}

/**
 * The answer must cover exactly the requested predicates and fields, with values each
 * field can hold, so an extractor bug fails the job before anything is asked.
 */
function assertAnswers(
  requests: ReadonlyMap<PredicateDeclaration, readonly string[]>,
  answer: SymbolAnswer,
): void {
  for (const predicate of answer.keys()) {
    if (!requests.has(predicate)) {
      throw new TypeError(`Extracted symbols answer unrequested predicate "${predicate.name}"`);
    }
  }
  for (const [predicate, fields] of requests) {
    const values = answer.get(predicate);
    if (values === undefined) {
      throw new TypeError(`Extracted symbols omit requested predicate "${predicate.name}"`);
    }
    const answered = Object.keys(values);
    if (answered.length !== fields.length || !fields.every((name) => Object.hasOwn(values, name))) {
      throw new TypeError(
        `Extracted symbols for "${predicate.name}" must answer exactly its fields: ${fields.join(", ")}`,
      );
    }
    for (const name of fields) {
      const type = predicate.params[name];
      if (!(values[name] ?? []).every((value) => holds(type, value))) {
        throw new TypeError(
          `Extracted symbols for ${predicate.name}.${name} must be valid values of its type`,
        );
      }
    }
  }
}

/** Whether a field of this type can hold the value: a finite number, valid date, or own entity. */
function holds(type: unknown, value: Scalar | Entity): boolean {
  if (type === String) {
    return typeof value === "string";
  }
  if (type === Number) {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (type === Date) {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }
  return isEntity(value) && value.constructor === type;
}

/** Drop structural duplicates, keeping the first occurrence. */
function unique(values: readonly (Scalar | Entity)[]): readonly (Scalar | Entity)[] {
  return values.filter(
    (value, index) => values.findIndex((other) => fieldEquals(value, other)) === index,
  );
}
