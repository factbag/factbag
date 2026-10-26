import type { EnumType } from "../types/schema";

/** Declare a nonempty finite domain of one member type. Values must be unique. */
export function enumeration<const Value extends string>(
  first: Value,
  ...rest: readonly Value[]
): EnumType<Value>;
/** Declare a nonempty finite number domain. NaN and duplicate values are rejected. */
export function enumeration<const Value extends number>(
  first: Value,
  ...rest: readonly Value[]
): EnumType<Value>;
/** Declare a nonempty finite date domain. Dates are copied and must have unique, valid instants. */
export function enumeration(first: Date, ...rest: readonly Date[]): EnumType<Date>;
export function enumeration(
  first: string | number | Date,
  ...rest: readonly (string | number | Date)[]
): EnumType {
  const kind = first instanceof Date ? "date" : typeof first;
  const seen = new Set<string | number>();
  const values = [first, ...rest].map((value) => {
    const memberKind = value instanceof Date ? "date" : typeof value;
    if (memberKind !== kind || (kind !== "string" && kind !== "number" && kind !== "date")) {
      throw new Error("Enum values must all be strings, numbers, or dates of one type");
    }
    const key = value instanceof Date ? value.getTime() : value;
    if (typeof key === "number" && Number.isNaN(key)) {
      throw new Error("Enum values must not be NaN or invalid dates");
    }
    if (seen.has(key)) {
      throw new Error("Enum values must be unique (dates compare by instant)");
    }
    seen.add(key);
    // Keep caller-owned date mutations from changing the declared domain.
    return value instanceof Date ? new Date(key) : value;
  });
  return Object.freeze({ kind: "enum", values: Object.freeze(values) });
}
