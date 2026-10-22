import type { Entity, GroundAtom, GroundFields, PredicateDeclaration } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import type { GuardedKB } from "@factbag/guards";
import type { JsonValue } from "@typesafe-ai/sdk";
import { UnsupportedPredicateError } from "./errors";
import type {
  Action,
  Candidate,
  ScalarDomains,
  SupportedField,
  SupportedPredicate,
  Tool,
} from "./types";

type CandidateValue = boolean | string | number | bigint | Date | Entity;

/**
 * How many candidates one request may ask about. Accuracy holds to roughly a hundred
 * candidates and then falls away: at several hundred the model starts attributing a
 * document's facts to candidates it does not mention. Splitting costs requests, and
 * resends the passage, but keeps each request's questions about a readable shortlist.
 */
const maximumCandidatesPerRequest = 64;

/**
 * Validate all exposed predicates before any corpus traversal or remote requests,
 * and enumerate each one's candidates once against the KB and the scalar domains. A
 * predicate with more candidates than one request may carry becomes several tools, each
 * with a slice of them. Query grants are excluded.
 */
export function prepareTools(access: GuardedKB, domains: ScalarDomains): readonly Tool[] {
  const actions = new Map<PredicateDeclaration, Set<Action>>();
  for (const { operation, predicate } of access.resolve()) {
    if (operation !== "query") {
      actions.set(predicate, (actions.get(predicate) ?? new Set<Action>()).add(operation));
    }
  }
  return [...actions].flatMap(([predicate, permitted]) => {
    const supported = validatePredicate(predicate, access.kb, domains);
    const candidates = enumerateCandidates(supported, access.kb, domains);
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

function validatePredicate(
  predicate: PredicateDeclaration,
  kb: KnowledgeBase,
  domains: ScalarDomains,
): SupportedPredicate {
  if (predicate.metadata === undefined || predicate.metadata.description.trim().length === 0) {
    throw new UnsupportedPredicateError(
      `Cannot classify predicate "${predicate.name}": metadata needs a description`,
      predicate,
    );
  }
  if (Object.keys(predicate.params).length !== predicate.paramNames.length) {
    throw new UnsupportedPredicateError(`Invalid schema for ${predicate.name}`, predicate);
  }
  assertSupportedType(predicate, domains);
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
    } else if (isScalarConstructor(type)) {
      if (scalarDomain(type, domains).length === 0) {
        throw new UnsupportedPredicateError(
          `No candidate values for ${predicate.name}.${name}: supply domains.${type.name}`,
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
  domains: ScalarDomains,
): asserts predicate is SupportedPredicate {
  for (const name of predicate.paramNames) {
    const type = predicate.params[name];
    if (type === undefined || (isScalarConstructor(type) && !(type.name in domains))) {
      throw new UnsupportedPredicateError(
        `Cannot classify predicate "${predicate.name}": field "${name}" has an unsupported open-ended domain. Use Boolean, enumeration(...), registered entities, or supply candidate values in domains.`,
        predicate,
        name,
      );
    }
  }
}

type ScalarConstructor =
  | DateConstructor
  | BigIntConstructor
  | NumberConstructor
  | StringConstructor;

function isScalarConstructor(type: unknown): type is ScalarConstructor {
  return type === Date || type === BigInt || type === Number || type === String;
}

/** The deduplicated candidate values supplied for one scalar constructor. */
function scalarDomain(type: ScalarConstructor, domains: ScalarDomains): readonly CandidateValue[] {
  const values: readonly CandidateValue[] =
    type === Date
      ? (domains.Date ?? [])
      : type === BigInt
        ? (domains.BigInt ?? [])
        : type === Number
          ? (domains.Number ?? [])
          : (domains.String ?? []);
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = scalarKey(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function scalarKey(value: CandidateValue): string {
  if (value instanceof Date) {
    return `date:${value.getTime()}`;
  }
  if (typeof value === "bigint") {
    return `bigint:${value.toString()}`;
  }
  if (typeof value === "number" || typeof value === "string") {
    return `${typeof value}:${value}`;
  }
  throw new Error("Scalar domains hold only dates, bigints, numbers and strings");
}

function enumerateCandidates(
  predicate: SupportedPredicate,
  kb: KnowledgeBase,
  domains: ScalarDomains,
): readonly Candidate[] {
  let combinations: Readonly<Record<string, CandidateValue>>[] = [{}];
  for (const name of predicate.paramNames) {
    const type = predicate.params[name];
    if (type === undefined) {
      throw new Error("A registered predicate's schema was modified");
    }
    const values = fieldValues(type, kb, domains);
    combinations = combinations.flatMap((fields) =>
      values.map((value) => ({ ...fields, [name]: value })),
    );
  }
  return combinations.filter(distinctEntities).map((fields, index) => {
    const encoded = Object.fromEntries(
      Object.entries(fields).map(([name, value]) => [name, encodeValue(value)]),
    );
    const atom: GroundAtom = { predicate, fields: fields satisfies GroundFields };
    return { id: `candidate_${index}`, atom, fields: encoded };
  });
}

/** Scalars as JSON: dates as ISO strings, bigints as decimal strings, entities as snapshots. */
function encodeValue(value: CandidateValue): JsonValue {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "object") {
    return encodeEntity(value);
  }
  return value;
}

/**
 * Drop candidates that put the same entity in more than one field. A party owning itself, or
 * a transfer from a party to itself, is not a proposition worth a question: it spends budget
 * and competes with the real candidates for the model's attention.
 */
function distinctEntities(fields: Readonly<Record<string, CandidateValue>>): boolean {
  const entities = Object.values(fields).filter(
    (value) => typeof value === "object" && !(value instanceof Date),
  );
  return new Set(entities).size === entities.length;
}

/** Snapshot enumerable entity properties using JSON semantics, retaining the entity type. */
function encodeEntity(entity: Entity): JsonValue {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A successful JSON round-trip produces a JSON value.
  return JSON.parse(JSON.stringify({ ...entity, type: entity.constructor.name })) as JsonValue;
}

function fieldValues(
  type: SupportedField,
  kb: KnowledgeBase,
  domains: ScalarDomains,
): readonly CandidateValue[] {
  if (type === Boolean) {
    return [false, true];
  }
  if (typeof type === "object") {
    return type.values;
  }
  if (isScalarConstructor(type)) {
    return scalarDomain(type, domains);
  }
  return kb.entities.ids(type).map((id) => {
    const entity = kb.entities.get(type, id);
    if (entity === undefined) {
      throw new Error("A registered entity domain was modified");
    }
    return entity;
  });
}
