import { assert } from "../assert";
import { assertIsGroundAtom, isGroundAtom } from "./atom";
import type { GroundAtom } from "./atom";
import { assertIsEvidenceMetadata, isEvidenceMetadata } from "./evidence-metadata";
import type { EvidenceMetadata } from "./evidence-metadata";
import { assertIsOptional, assertIsShape, isShape } from "../shape";
import type { Shape } from "../shape";

/**
 * Accepted evidence: a ground atom asserted (`+`) or denied (`-`), with where
 * it came from.
 */
export type Literal = Shape<"literal"> &
  Readonly<{
    sign: "+" | "-";
    atom: GroundAtom;
    metadata?: EvidenceMetadata;
  }>;

/** Return whether a value is a literal. */
export function isLiteral(value: unknown): value is Literal {
  return (
    isShape(value, "literal") &&
    (value["sign"] === "+" || value["sign"] === "-") &&
    isGroundAtom(value["atom"]) &&
    (value["metadata"] === undefined || isEvidenceMetadata(value["metadata"]))
  );
}

/** Assert that a value is a literal. */
export function assertIsLiteral(value: unknown): asserts value is Literal {
  assertIsShape(value, "literal");
  assert(value["sign"] === "+" || value["sign"] === "-");
  assertIsGroundAtom(value["atom"]);
  assertIsOptional(value["metadata"], assertIsEvidenceMetadata);
}
