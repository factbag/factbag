import { assert } from "./assert";
import { isPlainObject } from "./is-plain-object";

/**
 * The base of a contract shape that can stand where another shape could.
 * `kind` says which it is, and no two shapes share a kind. Shapes that only
 * ever appear in a position of their own (a predicate, a literal, a program)
 * carry no kind.
 */
export type Shape<Kind extends string> = Readonly<{ kind: Kind }>;

/** Return whether a value is a plain object of one of the given kinds. */
export function isShape<Kind extends string>(
  value: unknown,
  ...kinds: readonly Kind[]
): value is Shape<Kind> & Readonly<Record<string, unknown>> {
  return isPlainObject(value) && kinds.some((kind) => kind === value["kind"]);
}

/** Return whether a value is a plain object, keyed by name, whose every present entry passes `isEntry`. */
export function isRecordOf<Entry>(
  value: unknown,
  isEntry: (entry: unknown) => entry is Entry,
): value is Readonly<Record<string, Entry>> {
  return (
    isPlainObject(value) &&
    Object.values(value).every((entry) => entry === undefined || isEntry(entry))
  );
}

/** Return whether a value is an array whose every item passes `isItem`. */
export function isArrayOf<Item>(
  value: unknown,
  isItem: (item: unknown) => item is Item,
): value is readonly Item[] {
  return Array.isArray(value) && value.every((item) => isItem(item));
}

/** Return whether a value is a string that names something: not empty and not only whitespace. */
export function isName(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Assert that a value is a plain object of one of the given kinds. */
export function assertIsShape<Kind extends string>(
  value: unknown,
  ...kinds: readonly Kind[]
): asserts value is Shape<Kind> & Readonly<Record<string, unknown>> {
  assert(isShape(value, ...kinds));
}

/** Assert that a value is a plain object, keyed by name, whose every present entry passes `assertIsEntry`. */
export function assertIsRecordOf<Entry>(
  value: unknown,
  assertIsEntry: (entry: unknown) => asserts entry is Entry,
): asserts value is Readonly<Record<string, Entry>> {
  assert(isPlainObject(value));
  for (const entry of Object.values(value)) {
    assertIsOptional(entry, assertIsEntry);
  }
}

/** Assert that a value is an array whose every item passes `assertIsItem`. */
export function assertIsArrayOf<Item>(
  value: unknown,
  assertIsItem: (item: unknown) => asserts item is Item,
): asserts value is readonly Item[] {
  assert(Array.isArray(value));
  for (const item of value) {
    assertIsItem(item);
  }
}

/** Assert that a value is absent or passes `assertIsPresent`. */
export function assertIsOptional<Present>(
  value: unknown,
  assertIsPresent: (present: unknown) => asserts present is Present,
): asserts value is Present | undefined {
  if (value !== undefined) {
    assertIsPresent(value);
  }
}

/** Assert that a value is a string that names something. */
export function assertIsName(value: unknown): asserts value is string {
  assert(isName(value));
}

/** Assert that a value is a string. */
export function assertIsString(value: unknown): asserts value is string {
  assert(typeof value === "string");
}
