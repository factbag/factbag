import "@typespec/json-schema";
import "./value.tsp";

using TypeSpec.JsonSchema;

namespace Factbag.Contracts;

/** An atom as rules and queries write it: a predicate name and, for each field, a value or a variable. */
model Atom {
  kind: "atom";
  predicate: Name;
  fields: Record<Term>;
}

/** An atom with a value for every field and no variables, as evidence states it. */
model GroundAtom {
  kind: "atom";
  predicate: Name;
  fields: Record<Value>;
}
