import { assert } from "../assert";
import { isPlainObject } from "../is-plain-object";
import { assertIsAnnotations, isAnnotations } from "./annotations";
import type { Annotations } from "./annotations";
import { assertIsOptional, assertIsRecordOf, assertIsString, isRecordOf } from "../shape";

/**
 * Provenance metadata attached to accepted evidence literals: `source` names
 * where the fact came from, `citation` quotes or references the supporting
 * material, and `justification` records the asserter's stated reason.
 */
export type EvidenceMetadata = Readonly<{
  /** Name of the system or document the fact came from. */
  source?: string;
  /** Quotation or reference into the supporting material. */
  citation?: string;
  /** The asserter's stated reason for accepting the fact. */
  justification?: string;
  /** Named numeric scores; core stores these without combining or interpreting them. */
  scores?: Readonly<Record<string, number>>;
  /** Application-specific annotations, retained on supporting evidence in judgments. */
  annotations?: Annotations;
}>;

/** Return whether a value is evidence metadata that survives JSON unchanged. */
export function isEvidenceMetadata(value: unknown): value is EvidenceMetadata {
  return (
    isPlainObject(value) &&
    isOptionalString(value["source"]) &&
    isOptionalString(value["citation"]) &&
    isOptionalString(value["justification"]) &&
    (value["scores"] === undefined || isRecordOf(value["scores"], isFiniteNumber)) &&
    (value["annotations"] === undefined || isAnnotations(value["annotations"]))
  );
}

/** Assert that a value is evidence metadata that survives JSON unchanged. */
export function assertIsEvidenceMetadata(value: unknown): asserts value is EvidenceMetadata {
  assert(isPlainObject(value));
  assertIsOptional(value["source"], assertIsString);
  assertIsOptional(value["citation"], assertIsString);
  assertIsOptional(value["justification"], assertIsString);
  assertIsOptional(value["scores"], assertIsScores);
  assertIsOptional(value["annotations"], assertIsAnnotations);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertIsScores(value: unknown): asserts value is Readonly<Record<string, number>> {
  assertIsRecordOf(value, assertIsFiniteNumber);
}

function assertIsFiniteNumber(value: unknown): asserts value is number {
  assert(isFiniteNumber(value));
}
