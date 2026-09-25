import type { EnumType } from "../types/schema";

/** Declare a nonempty finite string domain. Values must be unique. */
export function enumeration<const Value extends string>(
  first: Value,
  ...rest: readonly Value[]
): EnumType<Value> {
  const values = [first, ...rest];
  if (values.some((value) => typeof value !== "string") || new Set(values).size !== values.length) {
    throw new Error("Enum values must be unique strings");
  }
  return Object.freeze({ kind: "enum", values: Object.freeze(values) });
}
