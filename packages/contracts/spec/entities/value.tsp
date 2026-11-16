import "@typespec/json-schema";

using TypeSpec.JsonSchema;

namespace Factbag.Contracts;

/** A string that names something: not empty and not only whitespace. */
@pattern("\\S")
scalar Name extends string;

// Values

/** A reference to an entity: its class name (`type`) and id. */
model EntityRef {
  kind: "entity";
  type: Name;
  id: string;
}

/** Which infinity. */
enum InfiniteNumberValue {
  positive: "Infinity",
  negative: "-Infinity",
}

/** An infinite number. Finite numbers are written as JSON numbers. */
model InfiniteNumber {
  kind: "number";
  value: InfiniteNumberValue;
}

/** A date, as an ISO 8601 UTC string in the exact form JavaScript's `Date.prototype.toISOString` writes. */
model DateValue {
  kind: "date";

  @pattern("^(\\d{4}|[+-]\\d{6})-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$")
  value: string;
}

/**
 * A ground value. Strings, finite numbers, and booleans are written as
 * themselves; infinities, dates, and entities are tagged.
 */
@oneOf
union Value {
  string,
  float64,
  boolean,
  InfiniteNumber,
  DateValue,
  EntityRef,
}

/** A logic variable. Names are scoped to one rule. */
model Variable {
  kind: "var";
  name: Name;
}

/** A field value in an atom: a ground value or a variable. */
@oneOf
union Term {
  Value,
  Variable,
}
