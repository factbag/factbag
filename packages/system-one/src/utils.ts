import type { AnyAtom } from "factbag/dsl";
import type { JsonValue } from "./provider";

/** Snapshot JSON data, including nested dates and entities identified by a string id. */
export function encode(value: unknown): JsonValue {
  const entities = new WeakMap<object, object>();
  const json: unknown = JSON.stringify(value, (_, item: unknown) => {
    if (!isRecord(item) || typeof item["id"] !== "string") {
      return item;
    }
    let entity = entities.get(item);
    if (entity === undefined) {
      entity = {
        ...item,
        type: typeof item.constructor === "function" ? item.constructor.name : "Object",
      };
      entities.set(item, entity);
    }
    return entity;
  });
  if (typeof json !== "string") {
    throw new TypeError("Cannot encode a value without a JSON representation");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Parsing serialized JSON produces a JSON value.
  return JSON.parse(json) as JsonValue;
}

/** A compact diagnostic label, using entity ids and the predicate's declared field order. */
export function formatAtom({ predicate, fields }: AnyAtom): string {
  return `${predicate.name}(${predicate.paramNames.map((name) => format(fields[name])).join(", ")})`;
}

function format(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return isRecord(value) && "id" in value ? String(value["id"]) : String(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A finite probability, including both endpoints. */
export function isProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
