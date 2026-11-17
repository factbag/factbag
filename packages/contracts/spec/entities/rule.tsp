import "@typespec/json-schema";
import "./atom.tsp";
import "./value.tsp";

using TypeSpec.JsonSchema;

namespace Factbag.Contracts;

/** The primitive arithmetic operations. */
enum ArithmeticKind {
  add,
  `sub`,
  mul,
  div,
  daysBetween,
  yearsBetween,
  min,
  max,
  roundTo,
  floorTo,
  ceilTo,
}

/** The comparison operations. */
enum ComparisonKind {
  eq,
  neq,
  lt,
  lte,
  gt,
  gte,
}

/** Applies a primitive operation to two expressions. */
model Arithmetic {
  kind: ArithmeticKind;
  left: Expression;
  right: Expression;
}

/** Whether an aggregate totals (`sum`) or counts (`count`) its matches. */
enum AggregateKind {
  sum,
  count,
}

/**
 * Totals (`sum`) or counts (`count`) `value` over every way the `where`
 * condition holds.
 */
model Aggregate {
  kind: AggregateKind;
  value: Expression;
  where: Condition;

  /** When the matches are known to be complete. */
  completeWhen?: Condition;
}

/** A value-producing expression in a rule body: a term, or a formula whose kind is its operator. */
@oneOf
union Expression {
  Term,
  Arithmetic,
  Aggregate,
}

/** Requires explicit evidence against an atom. */
model Not {
  kind: "not";
  atom: Atom;
}

/** Whether every argument must hold (`and`) or any (`or`). */
enum ConnectiveKind {
  and,
  or,
}

/** Holds when every (`and`) or any (`or`) of its conditions holds. */
model Connective {
  kind: ConnectiveKind;
  conditions: Condition[];
}

/** Holds when the condition holds for some values of the variables. */
model Exists {
  kind: "exists";
  variables: Variable[];
  condition: Condition;
}

/** Binds a variable to an expression's value for the condition that follows. */
model LetIn {
  kind: "letIn";
  variable: Variable;
  value: Expression;
  condition: Condition;
}

/** Compares two expressions. */
model Comparison {
  kind: ComparisonKind;
  left: Expression;
  right: Expression;
}

/** A rule-body condition: an atom, a negated atom, or a formula whose kind is its operator. */
@extension(
  "discriminator",
  #{
    propertyName: "kind",
    mapping: #{
      atom: "Atom.json",
      not: "Not.json",
      and: "Connective.json",
      or: "Connective.json",
      exists: "Exists.json",
      letIn: "LetIn.json",
      eq: "Comparison.json",
      neq: "Comparison.json",
      lt: "Comparison.json",
      lte: "Comparison.json",
      gt: "Comparison.json",
      gte: "Comparison.json",
    },
  }
)
@oneOf
union Condition {
  Atom,
  Not,
  Connective,
  Exists,
  LetIn,
  Comparison,
}

/** Rule semantics: `if` states a sufficient condition, `iff` a definition. */
enum RuleKind {
  `if`,
  iff,
}

/** A rule: the head holds `if` (or, for `iff`, exactly when) the body holds. */
model Rule {
  kind: RuleKind;
  head: Atom;
  body: Condition;
}

