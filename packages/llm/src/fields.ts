import type { EnumType, PredicateSchema } from "factbag/dsl";
import type { KnowledgeBase } from "factbag/kb";
import { CorrectableToolError } from "./errors";
import type { ToolFieldSchema } from "./types";

type FieldType = PredicateSchema[string];

/**
 * Describe one predicate field as a JSON argument. Entity fields list the IDs the KB
 * knows now, so call this again after adding entities.
 */
export function fieldSchema(kb: KnowledgeBase, type: FieldType): ToolFieldSchema {
  if (isEnum(type)) {
    const values = jsonValues(type);
    return { type: typeof values[0] === "number" ? "number" : "string", enum: values };
  }
  if (type === String) {
    return { type: "string" };
  }
  if (type === Number) {
    return { type: "number" };
  }
  if (type === Boolean) {
    return { type: "boolean" };
  }
  if (type === Date) {
    return { type: "string", description: "ISO 8601 date-time" };
  }
  const ids = kb.entities.ids(type);
  const description = `${type.name} id`;
  return ids.length === 0
    ? { type: "string", description }
    : { type: "string", description, enum: ids };
}

/** Turn one JSON argument into the field value the predicate expects. */
export function parseField(
  kb: KnowledgeBase,
  name: string,
  type: FieldType,
  value: unknown,
): unknown {
  if (isEnum(type)) {
    const allowed = jsonValues(type);
    const index = allowed.findIndex((member) => member === value);
    if (index === -1) {
      throw new CorrectableToolError(`Expected ${name} to be one of: ${allowed.join(", ")}`);
    }
    return type.values[index];
  }
  if (type === String || type === Number || type === Boolean) {
    const expected = type.name.toLowerCase();
    if (typeof value !== expected) {
      throw new CorrectableToolError(`Expected ${name} to be a ${expected}`);
    }
    return value;
  }
  if (type === Date) {
    const date = new Date(requireString(name, value, "an ISO 8601 date-time"));
    if (Number.isNaN(date.getTime())) {
      throw new CorrectableToolError(`Expected ${name} to be an ISO 8601 date-time`);
    }
    return date;
  }
  const entity = kb.entities.get(type, requireString(name, value, `a ${type.name} id`));
  if (entity === undefined) {
    throw new CorrectableToolError(`Unknown ${type.name} id for ${name}: ${String(value)}`);
  }
  return entity;
}

function requireString(name: string, value: unknown, description: string): string {
  if (typeof value !== "string") {
    throw new CorrectableToolError(`Expected ${name} to be ${description}`);
  }
  return value;
}

/** Enumeration members as JSON: dates become ISO 8601 strings, in declaration order. */
function jsonValues(type: EnumType): readonly (string | number)[] {
  return type.values.map((value) => (value instanceof Date ? value.toISOString() : value));
}

function isEnum(type: FieldType): type is EnumType {
  return typeof type === "object";
}
