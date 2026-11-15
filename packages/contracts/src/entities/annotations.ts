import { assert } from "../assert";
import { isPlainObject } from "../is-plain-object";
import { assertIsArrayOf, assertIsRecordOf, isArrayOf, isRecordOf } from "../shape";

/** JSON-compatible annotation data carried without interpretation by core. */
export type AnnotationValue =
  | null
  | boolean
  | number
  | string
  | readonly AnnotationValue[]
  | { readonly [key: string]: AnnotationValue };

/** Application-defined, serializable annotations. */
export type Annotations = Readonly<Record<string, AnnotationValue>>;

/** Return whether a value is annotations: an object of JSON data. */
export function isAnnotations(value: unknown): value is Annotations {
  return isRecordOf(value, isAnnotationValue);
}

function isAnnotationValue(value: unknown): value is AnnotationValue {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    isArrayOf(value, isAnnotationValue) ||
    isRecordOf(value, isAnnotationValue)
  );
}

export function assertIsAnnotations(value: unknown): asserts value is Annotations {
  assertIsRecordOf(value, assertIsAnnotationValue);
}

function assertIsAnnotationValue(value: unknown): asserts value is AnnotationValue {
  if (Array.isArray(value)) {
    assertIsArrayOf(value, assertIsAnnotationValue);
  } else if (isPlainObject(value)) {
    assertIsRecordOf(value, assertIsAnnotationValue);
  } else {
    assert(
      value === null ||
        typeof value === "boolean" ||
        typeof value === "string" ||
        (typeof value === "number" && Number.isFinite(value)),
    );
  }
}
