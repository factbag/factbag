/** A logic variable placeholder used in rule heads, rule bodies, and query patterns. */
export class Var<Name extends string = string> {
  /** Display name used when formatting goals, bindings, and explanations. */
  readonly name: Name;

  /**
   * Create a variable with a display name.
   *
   * @throws Error when the name is empty or only whitespace.
   */
  constructor(name: Name) {
    if (name.trim() === "") {
      throw new Error("Variable name cannot be empty");
    }
    this.name = name;
    Object.freeze(this);
  }
}

/** Return whether a runtime value is a logic variable. */
export function isVar(value: unknown): value is Var {
  return value instanceof Var;
}
