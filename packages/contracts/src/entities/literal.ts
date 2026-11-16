import { assert } from "../assert";
import { assertIsGroundAtom, isGroundAtom } from "./atom";
import type { GroundAtom } from "./atom";
import { assertIsEvidenceMetadata, isEvidenceMetadata } from "./evidence-metadata";
import type { EvidenceMetadata } from "./evidence-metadata";
import { isPlainObject } from "../is-plain-object";
import { assertIsOptional } from "../shape";

/**
 * Accepted evidence: a ground atom asserted or denied, with where
 * it came from.
 */
export type Literal = Readonly<{
  sign: "asserted" | "denied";
  atom: GroundAtom;
  metadata?: EvidenceMetadata;
}>;

/** Return whether a value is a literal. */
export function isLiteral(value: unknown): value is Literal {
  return (
    isPlainObject(value) &&
    (value["sign"] === "asserted" || value["sign"] === "denied") &&
    isGroundAtom(value["atom"]) &&
    (value["metadata"] === undefined || isEvidenceMetadata(value["metadata"]))
  );
}

/** Assert that a value is a literal. */
export function assertIsLiteral(value: unknown): asserts value is Literal {
  assert(isPlainObject(value));
  assert(value["sign"] === "asserted" || value["sign"] === "denied");
  assertIsGroundAtom(value["atom"]);
  assertIsOptional(value["metadata"], assertIsEvidenceMetadata);
}
