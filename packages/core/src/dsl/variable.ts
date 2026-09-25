import { Var } from "../types/variable";

/** Create a logic variable for use in rule heads, rule bodies, and query patterns. */
export function variable<const Name extends string>(name: Name): Var<Name> {
  return new Var(name);
}
