import "@typespec/json-schema";
import "./evidence.tsp";
import "./value.tsp";

using TypeSpec.JsonSchema;

namespace Factbag.Contracts;

/** A field holding any string, number, boolean, or date. */
enum ScalarType {
  string,
  number,
  boolean,
  date,
}

/** A value an enum field may list. */
@oneOf
union EnumValue {
  string,
  float64,
  InfiniteNumber,
  DateValue,
}

/** A field holding one of a fixed set of strings, numbers, or dates. */
model EnumType {
  kind: "enum";
  values: EnumValue[];
}

/** A field holding entities of one class, named by `type`. */
model EntityType {
  kind: "entityType";
  type: Name;
}

/** The type of one predicate field. */
@oneOf
union FieldType {
  ScalarType,
  EnumType,
  EntityType,
}

/** Domain guidance for interpreting a predicate, available to evidence producers. */
model PredicateMetadata {
  description: string;
  instructions?: string;
  parameters?: Record<string>;
  annotations?: Annotations;
}

/** Whether absence of evidence counts as falsity (`closed`) or unknown (`open`). */
enum PredicateWorld {
  open,
  closed,
}

/** A predicate declaration: its name, world, and the type of each field. */
model Predicate {
  name: Name;
  world: PredicateWorld;
  params: Record<FieldType>;
  metadata?: PredicateMetadata;
}

// Rules
