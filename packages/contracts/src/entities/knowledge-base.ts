import { assert } from "../assert";
import { assertIsEntityRef, isEntityRef } from "./entity";
import type { EntityRef } from "./entity";
import { assertIsProgram, isProgram } from "./program";
import type { Program } from "./program";
import { assertIsArrayOf, assertIsShape, isArrayOf, isShape } from "../shape";
import type { Shape } from "../shape";

/** A whole knowledge base as a document: a versioned program plus its registered entities. */
export type KnowledgeBaseDocument = Shape<"KnowledgeBase"> &
  Program &
  Readonly<{
    /** Format version. */
    apiVersion: "factbag/v1alpha1";
    /** Entities registered with the knowledge base. */
    entities: readonly EntityRef[];
  }>;

/** Return whether a value is a knowledge-base document. */
export function isKnowledgeBaseDocument(value: unknown): value is KnowledgeBaseDocument {
  return (
    isShape(value, "KnowledgeBase") &&
    value["apiVersion"] === "factbag/v1alpha1" &&
    isArrayOf(value["entities"], isEntityRef) &&
    isProgram(value)
  );
}

/** Assert that a value is a knowledge-base document. */
export function assertIsKnowledgeBaseDocument(
  value: unknown,
): asserts value is KnowledgeBaseDocument {
  assertIsShape(value, "KnowledgeBase");
  assert(value["apiVersion"] === "factbag/v1alpha1");
  assertIsArrayOf(value["entities"], assertIsEntityRef);
  assertIsProgram(value);
}
