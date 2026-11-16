import { assert } from "../assert";
import { isPlainObject } from "../is-plain-object";
import { assertIsAnnotations, isAnnotations } from "./annotations";
import type { Annotations } from "./annotations";
import {
  assertIsArrayOf,
  assertIsName,
  assertIsOptional,
  assertIsRecordOf,
  assertIsString,
  isArrayOf,
  isName,
  isRecordOf,
  isShape,
} from "../shape";
import type { Shape } from "../shape";
import { assertIsValue, isValue, valueEquals } from "./value";
import type { DateValue, InfiniteNumber, Value } from "./value";

/** A predicate declaration: its name, world, and the type of each field. */
export type Predicate = Readonly<{
  name: string;
  world: PredicateWorld;
  params: Readonly<Record<string, FieldType>>;
  metadata?: PredicateMetadata;
}>;

/** Whether absence of evidence counts as falsity (`closed`) or unknown (`open`). */
export type PredicateWorld = "open" | "closed";

/** The type of one predicate field. */
export type FieldType = ScalarType | EnumType | EntityType;

/** A field holding any string, number, boolean, or date. */
export type ScalarType = "string" | "number" | "boolean" | "date";

/** A field holding one of a fixed set of strings, numbers, or dates. */
export type EnumType = Shape<"enum"> & Readonly<{ values: readonly EnumValue[] }>;

/** A value an enum field may list. */
export type EnumValue = string | number | InfiniteNumber | DateValue;

/** A field holding entities of one class, named by `type`. */
export type EntityType = Shape<"entityType"> & Readonly<{ type: string }>;

/** Domain guidance for interpreting a predicate, available to evidence producers. */
export type PredicateMetadata = Readonly<{
  description: string;
  instructions?: string;
  parameters?: Readonly<Record<string, string>>;
  annotations?: Annotations;
}>;

/** Return whether a value is a predicate declaration. */
export function isPredicate(value: unknown): value is Predicate {
  return (
    isPlainObject(value) &&
    isName(value["name"]) &&
    (value["world"] === "open" || value["world"] === "closed") &&
    isRecordOf(value["params"], isFieldType) &&
    (value["metadata"] === undefined || isPredicateMetadata(value["metadata"]))
  );
}

/** Assert that a value is a predicate declaration. */
export function assertIsPredicate(value: unknown): asserts value is Predicate {
  assert(isPlainObject(value));
  assertIsName(value["name"]);
  assert(value["world"] === "open" || value["world"] === "closed");
  assertIsRecordOf(value["params"], assertIsFieldType);
  assertIsOptional(value["metadata"], assertIsPredicateMetadata);
}

/** Return whether a field of the given type may hold a value. */
export function fieldAccepts(type: FieldType, value: Value): boolean {
  if (type === "string" || type === "boolean") {
    return typeof value === type;
  }
  if (type === "number") {
    return typeof value === "number" || isShape(value, "number");
  }
  if (type === "date") {
    return isShape(value, "date");
  }
  return type.kind === "enum"
    ? type.values.some((member) => valueEquals(member, value))
    : isShape(value, "entity") && value.type === type.type;
}

/** Return whether a value is one an enum field may list. */
export function isEnumValue(value: unknown): value is EnumValue {
  return typeof value !== "boolean" && !isShape(value, "entity") && isValue(value);
}

function isFieldType(value: unknown): value is FieldType {
  return (
    value === "string" ||
    value === "number" ||
    value === "boolean" ||
    value === "date" ||
    (isShape(value, "enum") && isArrayOf(value["values"], isEnumValue)) ||
    (isShape(value, "entityType") && isName(value["type"]))
  );
}

function isPredicateMetadata(value: unknown): value is PredicateMetadata {
  return (
    isPlainObject(value) &&
    typeof value["description"] === "string" &&
    (value["instructions"] === undefined || typeof value["instructions"] === "string") &&
    (value["parameters"] === undefined || isRecordOf(value["parameters"], isString)) &&
    (value["annotations"] === undefined || isAnnotations(value["annotations"]))
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function assertIsFieldType(value: unknown): asserts value is FieldType {
  if (isShape(value, "enum")) {
    assertIsArrayOf(value["values"], assertIsEnumValue);
  } else if (isShape(value, "entityType")) {
    assertIsName(value["type"]);
  } else {
    assert(value === "string" || value === "number" || value === "boolean" || value === "date");
  }
}

function assertIsEnumValue(value: unknown): asserts value is EnumValue {
  assert(typeof value !== "boolean" && !isShape(value, "entity"));
  assertIsValue(value);
}

function assertIsPredicateMetadata(value: unknown): asserts value is PredicateMetadata {
  assert(isPlainObject(value));
  assertIsString(value["description"]);
  assertIsOptional(value["instructions"], assertIsString);
  assertIsOptional(value["parameters"], assertIsParameters);
  assertIsOptional(value["annotations"], assertIsAnnotations);
}

function assertIsParameters(value: unknown): asserts value is Readonly<Record<string, string>> {
  assertIsRecordOf(value, assertIsString);
}
