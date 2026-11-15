import { isShape } from "../shape";
import { assertIsValue, isValue } from "./value";
import type { Value } from "./value";
import { assertIsVariable, isVariable } from "./variable";
import type { Variable } from "./variable";

/** A field value in an atom: a ground value or a variable. */
export type Term = Value | Variable;

/** Return whether a value is a ground value or a variable. */
export function isTerm(value: unknown): value is Term {
  return isVariable(value) || isValue(value);
}

/** Assert that a value is a ground value or a variable. */
export function assertIsTerm(value: unknown): asserts value is Term {
  if (isShape(value, "var")) {
    assertIsVariable(value);
  } else {
    assertIsValue(value);
  }
}
