import { assertIsName, assertIsShape, assertIsString, isName, isShape } from "../shape";
import type { Shape } from "../shape";

/** A reference to an entity: its class name (`type`) and id. */
export type EntityRef = Shape<"entity"> & Readonly<{ type: string; id: string }>;

/** Return whether a value is an entity reference. */
export function isEntityRef(value: unknown): value is EntityRef {
  return isShape(value, "entity") && isName(value["type"]) && typeof value["id"] === "string";
}

/** Assert that a value is an entity reference. */
export function assertIsEntityRef(value: unknown): asserts value is EntityRef {
  assertIsShape(value, "entity");
  assertIsName(value["type"]);
  assertIsString(value["id"]);
}
