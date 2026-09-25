import type { Entity, GroundAtom, GroundFields, PredicateDeclaration } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import type { GuardedKB } from "@factbag/guards";
import type { JsonValue } from "@typesafe-ai/sdk";
import { UnsupportedPredicateError } from "./errors";
import type { Action, Candidate, SupportedField, SupportedPredicate, Tool } from "./types";

type CandidateValue = boolean | string | Entity;

/**
 * How many candidates one request may ask about. Accuracy holds to roughly a hundred
 * candidates and then falls away: at several hundred the model starts attributing a
 * document's facts to candidates it does not mention. Splitting costs requests, and
 * resends the passage, but keeps each request's questions about a readable shortlist.
 */
const maximumCandidatesPerRequest = 64;

/**
 * Validate all exposed predicates before any corpus traversal or remote requests,
 * and enumerate each one's candidates once against the KB. A predicate with more
 * candidates than one request may carry becomes several tools, each with a slice of
 * them. Query grants are excluded.
 */
export function prepareTools(access: GuardedKB): readonly Tool[] {
  const actions = new Map<PredicateDeclaration, Set<Action>>();
  for (const { operation, predicate } of access.resolve()) {
    if (operation !== "query") {
      actions.set(predicate, (actions.get(predicate) ?? new Set<Action>()).add(operation));
    }
  }
  return [...actions].flatMap(([predicate, permitted]) => {
    const supported = validatePredicate(predicate, access.kb);
    const candidates = enumerateCandidates(supported, access.kb);
    return batches(candidates, maximumCandidatesPerRequest).map((slice) => ({
      predicate: supported,
      actions: permitted,
      candidates: slice,
    }));
  });
}

/** Split candidates into request-sized slices, keeping enumeration order. */
function batches(
  candidates: readonly Candidate[],
  size: number,
): readonly (readonly Candidate[])[] {
  if (candidates.length <= size) {
    return [candidates];
  }
  const slices: (readonly Candidate[])[] = [];
  for (let start = 0; start < candidates.length; start += size) {
    slices.push(candidates.slice(start, start + size));
  }
  return slices;
}

function validatePredicate(predicate: PredicateDeclaration, kb: KnowledgeBase): SupportedPredicate {
  if (predicate.metadata === undefined || predicate.metadata.description.trim().length === 0) {
    throw new UnsupportedPredicateError(
      `Cannot classify predicate "${predicate.name}": metadata needs a description`,
      predicate,
    );
  }
  if (Object.keys(predicate.params).length !== predicate.paramNames.length) {
    throw new UnsupportedPredicateError(`Invalid schema for ${predicate.name}`, predicate);
  }
  assertSupportedType(predicate);
  for (const name of predicate.paramNames) {
    const type = predicate.params[name];
    if (type === undefined) {
      throw new UnsupportedPredicateError(
        `Missing schema for ${predicate.name}.${name}`,
        predicate,
        name,
      );
    }
    if (typeof type === "object") {
      if (
        type.values.length === 0 ||
        type.values.some((value) => typeof value !== "string") ||
        new Set(type.values).size !== type.values.length
      ) {
        throw new UnsupportedPredicateError(
          `Invalid enum domain for ${predicate.name}.${name}`,
          predicate,
          name,
        );
      }
    } else if (type !== Boolean && kb.entities.ids(type).length === 0) {
      throw new UnsupportedPredicateError(
        `No registered entities for ${predicate.name}.${name}`,
        predicate,
        name,
      );
    }
  }
  return predicate;
}

function assertSupportedType(
  predicate: PredicateDeclaration,
): asserts predicate is SupportedPredicate {
  for (const name of predicate.paramNames) {
    const type = predicate.params[name];
    if (
      type === String ||
      type === Number ||
      type === BigInt ||
      type === Date ||
      type === undefined
    ) {
      throw new UnsupportedPredicateError(
        `Cannot classify predicate "${predicate.name}": field "${name}" has an unsupported open-ended domain. Use Boolean, enumeration(...), or registered entities.`,
        predicate,
        name,
      );
    }
  }
}

function enumerateCandidates(
  predicate: SupportedPredicate,
  kb: KnowledgeBase,
): readonly Candidate[] {
  let combinations: Readonly<Record<string, CandidateValue>>[] = [{}];
  for (const name of predicate.paramNames) {
    const type = predicate.params[name];
    if (type === undefined) {
      throw new Error("A registered predicate's schema was modified");
    }
    const values = fieldValues(type, kb);
    combinations = combinations.flatMap((fields) =>
      values.map((value) => ({ ...fields, [name]: value })),
    );
  }
  return combinations.filter(distinctEntities).map((fields, index) => {
    const encoded = Object.fromEntries(
      Object.entries(fields).map(([name, value]) => [
        name,
        typeof value === "object" ? encodeEntity(value) : value,
      ]),
    );
    const atom: GroundAtom = { predicate, fields: fields satisfies GroundFields };
    return { id: `candidate_${index}`, atom, fields: encoded };
  });
}

/**
 * Drop candidates that put the same entity in more than one field. A party owning itself, or
 * a transfer from a party to itself, is not a proposition worth a question: it spends budget
 * and competes with the real candidates for the model's attention.
 */
function distinctEntities(fields: Readonly<Record<string, CandidateValue>>): boolean {
  const entities = Object.values(fields).filter((value) => typeof value === "object");
  return new Set(entities).size === entities.length;
}

/** Snapshot enumerable entity properties using JSON semantics, retaining the entity type. */
function encodeEntity(entity: Entity): JsonValue {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A successful JSON round-trip produces a JSON value.
  return JSON.parse(JSON.stringify({ ...entity, type: entity.constructor.name })) as JsonValue;
}

function fieldValues(type: SupportedField, kb: KnowledgeBase): readonly CandidateValue[] {
  if (type === Boolean) {
    return [false, true];
  }
  if (typeof type === "object") {
    return type.values;
  }
  return kb.entities.ids(type).map((id) => {
    const entity = kb.entities.get(type, id);
    if (entity === undefined) {
      throw new Error("A registered entity domain was modified");
    }
    return entity;
  });
}
