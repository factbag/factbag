import { assert } from "../assert";
import { assertIsEntityRef, isEntityRef } from "./entity";
import type { EntityRef } from "./entity";
import { assertIsString, isShape } from "../shape";
import type { Shape } from "../shape";

/**
 * A ground value. Strings, finite numbers, and booleans are written as
 * themselves; infinities, dates, and entities, which JSON cannot hold
 * directly, are tagged. Every value has exactly one written form.
 */
export type Value = string | number | boolean | InfiniteNumber | DateValue | EntityRef;

/** An infinite number. Finite numbers are written as JSON numbers. */
export type InfiniteNumber = Shape<"number"> & Readonly<{ value: "Infinity" | "-Infinity" }>;

/** A date, as an ISO 8601 UTC string in the exact form `Date.prototype.toISOString` writes. */
export type DateValue = Shape<"date"> & Readonly<{ value: string }>;

/** Return whether a value is a ground value in its one written form. */
export function isValue(value: unknown): value is Value {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    isInfiniteNumber(value) ||
    isDateValue(value) ||
    isEntityRef(value)
  );
}

/** Assert that a value is a ground value in its one written form. */
export function assertIsValue(value: unknown): asserts value is Value {
  if (isShape(value, "number")) {
    assert(value["value"] === "Infinity" || value["value"] === "-Infinity");
  } else if (isShape(value, "date")) {
    const iso = value["value"];
    assertIsString(iso);
    const date = new Date(iso);
    assert(!Number.isNaN(date.getTime()) && date.toISOString() === iso);
  } else if (isShape(value, "entity")) {
    assertIsEntityRef(value);
  } else {
    assert(
      typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)),
    );
  }
}

/** Return whether two values are the same value. */
export function valueEquals(left: Value, right: Value): boolean {
  if (typeof left !== "object" || typeof right !== "object") {
    return left === right;
  }
  if (left.kind === "entity") {
    return right.kind === "entity" && left.type === right.type && left.id === right.id;
  }
  return left.kind === right.kind && left.value === right.value;
}

function isInfiniteNumber(value: unknown): value is InfiniteNumber {
  return (
    isShape(value, "number") && (value["value"] === "Infinity" || value["value"] === "-Infinity")
  );
}

function isDateValue(value: unknown): value is DateValue {
  if (!isShape(value, "date") || typeof value["value"] !== "string") {
    return false;
  }
  const date = new Date(value["value"]);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value["value"];
}
