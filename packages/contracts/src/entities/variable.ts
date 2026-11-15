import { assertIsName, assertIsShape, isName, isShape } from "../shape";
import type { Shape } from "../shape";

/** A logic variable. Names are scoped to one rule. */
export type Variable = Shape<"var"> & Readonly<{ name: string }>;

/** Return whether a value is a variable. */
export function isVariable(value: unknown): value is Variable {
  return isShape(value, "var") && isName(value["name"]);
}

/** Assert that a value is a variable. */
export function assertIsVariable(value: unknown): asserts value is Variable {
  assertIsShape(value, "var");
  assertIsName(value["name"]);
}
