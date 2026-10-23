import type { Entity, InferRuntime, PredicateSchema } from "./schema";
import { isVar } from "./variable";
import type { Var } from "./variable";
import type { PredicateDeclaration } from "./predicate";
import { assert } from "../utils/assert";

/** An atom whose exact schema has been intentionally erased. */
export type AnyAtom = Readonly<{
  predicate: PredicateDeclaration;
  fields: Readonly<Record<string, unknown>>;
}>;

/** Static groundedness state carried by an atom type. */
type AtomState = "ground" | "non-ground";

/** Field values for a fully grounded atom: no logic variables are present. */
export type GroundFields<Schema extends PredicateSchema = PredicateSchema> = Readonly<{
  [Name in keyof Schema]: InferRuntime<Schema[Name]>;
}>;

/** Field values for a pattern atom: concrete values or logic variables. */
export type PatternFields<Schema extends PredicateSchema = PredicateSchema> = Readonly<{
  [Name in keyof Schema]: InferRuntime<Schema[Name]> | Var;
}>;

/** Resolve the field map type for an atom based on its groundedness state. */
type AtomFields<Schema extends PredicateSchema, State extends AtomState> = State extends "ground"
  ? GroundFields<Schema>
  : PatternFields<Schema>;

/** Shared atom representation parameterized by schema and groundedness. */
type AtomForState<Schema extends PredicateSchema, State extends AtomState> = Readonly<{
  predicate: PredicateDeclaration<Schema>;
  fields: AtomFields<Schema, State>;
}>;

/** An atom whose fields are all concrete runtime values. */
export type GroundAtom<Schema extends PredicateSchema = PredicateSchema> = AtomForState<
  Schema,
  "ground"
>;
/** An atom pattern that may contain one or more logic variables. */
export type NonGroundAtom<Schema extends PredicateSchema = PredicateSchema> = AtomForState<
  Schema,
  "non-ground"
>;

/** An atom whose groundedness has not yet been narrowed by a runtime guard. */
export type Atom<Schema extends PredicateSchema = PredicateSchema> =
  | GroundAtom<Schema>
  | NonGroundAtom<Schema>;

/** Return whether an atom has no logic variables in its fields. */
export function isGroundAtom<Schema extends PredicateSchema>(
  atom: Atom<Schema>,
): atom is GroundAtom<Schema> {
  return Object.values(atom.fields).every((value) => !isVar(value));
}

/** Assert that an atom has no logic variables in its fields. */
export function assertGroundAtom<Schema extends PredicateSchema>(
  atom: Atom<Schema>,
): asserts atom is GroundAtom<Schema> {
  assert(isGroundAtom(atom), "Expected a ground atom");
}

/** Return whether an unknown value has the runtime shape of an atom. */
export function isAtomLike(value: unknown): value is AnyAtom {
  if (!isRecord(value)) {
    return false;
  }

  return isPredicateDeclaration(value["predicate"]) && isRecord(value["fields"]);
}

/** Assert that an unknown value has the runtime shape of an atom. */
export function assertAtomLike(value: unknown): asserts value is AnyAtom {
  assert(isAtomLike(value), "Expected an atom-like value");
}

/**
 * Narrow a schema-erased atom to a predicate by declaration identity and field
 * shape. Identity is the real guarantor: an atom carrying this predicate was
 * built by its constructor, so its fields already satisfy the schema.
 */
export function isAtomForPredicate<Schema extends PredicateSchema>(
  atom: AnyAtom,
  predicate: PredicateDeclaration<Schema>,
): atom is Atom<Schema> {
  const fieldNames = Object.keys(atom.fields);
  return (
    atom.predicate === predicate &&
    fieldNames.length === predicate.paramNames.length &&
    predicate.paramNames.every((name) => Object.prototype.hasOwnProperty.call(atom.fields, name))
  );
}

/** Return whether two atoms have the same predicate and field values. */
export function atomEquals(left: AnyAtom, right: AnyAtom): boolean {
  if (left.predicate !== right.predicate) {
    return false;
  }

  const leftEntries = Object.entries(left.fields);
  if (leftEntries.length !== Object.keys(right.fields).length) {
    return false;
  }

  return leftEntries.every(([name, value]) => fieldEquals(right.fields[name], value));
}

/**
 * Return whether two atom field values denote the same thing: entities by
 * type + id, everything else (primitives, variables) by reference identity.
 */
export function fieldEquals(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  if (isEntityValue(left) && isEntityValue(right)) {
    return left.constructor === right.constructor && left.id === right.id;
  }

  return left === right;
}

/** Canonical JSON-safe token for a field value, for use in string identity keys. */
export function fieldIdentityToken(value: unknown): unknown {
  if (value instanceof Date) {
    return ["date", value.getTime()];
  }
  if (isEntityValue(value)) {
    return ["entity", value.constructor.name, value.id];
  }
  if (typeof value === "bigint") {
    return ["bigint", value.toString()];
  }

  return value;
}

export function isEntityValue(value: unknown): value is Entity & { constructor: { name: string } } {
  if (!isRecord(value) || typeof value["id"] !== "string") {
    return false;
  }

  const constructor = value["constructor"];
  return isObjectLike(constructor) && typeof constructor["name"] === "string";
}

function isPredicateDeclaration(value: unknown): value is PredicateDeclaration {
  if (!isObjectLike(value)) {
    return false;
  }

  return (
    typeof value["name"] === "string" &&
    isRecord(value["params"]) &&
    Array.isArray(value["paramNames"]) &&
    value["paramNames"].every((name) => typeof name === "string") &&
    (value["world"] === "open" || value["world"] === "closed")
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isObjectLike(value: unknown): value is Readonly<Record<string, unknown>> {
  return (typeof value === "object" || typeof value === "function") && value !== null;
}
