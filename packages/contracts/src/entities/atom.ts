import {
  assertIsName,
  assertIsRecordOf,
  assertIsShape,
  isName,
  isRecordOf,
  isShape,
} from "../shape";
import type { Shape } from "../shape";
import { assertIsTerm, isTerm } from "./term";
import type { Term } from "./term";
import { assertIsValue, isValue } from "./value";
import type { Value } from "./value";

/**
 * An atom as rules and queries write it: a predicate name and, for each
 * field, a value or a variable.
 */
export type Atom = Shape<"atom"> &
  Readonly<{
    predicate: string;
    fields: Readonly<Record<string, Term>>;
  }>;

/** An atom with a value for every field and no variables, as evidence states it. */
export type GroundAtom = Shape<"atom"> &
  Readonly<{
    predicate: string;
    fields: Readonly<Record<string, Value>>;
  }>;

/** Return whether a value is an atom. */
export function isAtom(value: unknown): value is Atom {
  return (
    isShape(value, "atom") && isName(value["predicate"]) && isRecordOf(value["fields"], isTerm)
  );
}

/** Assert that a value is an atom. */
export function assertIsAtom(value: unknown): asserts value is Atom {
  assertIsShape(value, "atom");
  assertIsName(value["predicate"]);
  assertIsRecordOf(value["fields"], assertIsTerm);
}

/** Return whether a value is an atom without variables. */
export function isGroundAtom(value: unknown): value is GroundAtom {
  return (
    isShape(value, "atom") && isName(value["predicate"]) && isRecordOf(value["fields"], isValue)
  );
}

/** Assert that a value is an atom without variables. */
export function assertIsGroundAtom(value: unknown): asserts value is GroundAtom {
  assertIsShape(value, "atom");
  assertIsName(value["predicate"]);
  assertIsRecordOf(value["fields"], assertIsValue);
}
