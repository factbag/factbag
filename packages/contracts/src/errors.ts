import { isPlainObject } from "./is-plain-object";
import type { ArithmeticKind } from "./entities/expression";
import type { Predicate } from "./entities/predicate";
import type { Rule } from "./entities/rule";
import type { Variable } from "./entities/variable";
import type { ArithmeticGoal } from "./solver/goal";

/** Base class for errors that mean the caller supplied invalid program logic. */
export class ProgrammerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgrammerError";
  }
}

/** Arithmetic primitive with operands the solver cannot legally evaluate. */
export class PrimitiveArithmeticProgrammerError extends ProgrammerError {
  /** The arithmetic operation that failed. */
  readonly operation: ArithmeticKind;
  /** The evaluated left and right operand values. */
  readonly operands: readonly [unknown, unknown];
  /** The arithmetic goal being evaluated when the failure occurred. */
  readonly goal: ArithmeticGoal;

  constructor(
    operation: ArithmeticKind,
    operands: readonly [unknown, unknown],
    goal: ArithmeticGoal,
  ) {
    super(describeArithmeticFailure(operation, operands));
    this.name = "PrimitiveArithmeticProgrammerError";
    this.operation = operation;
    this.operands = operands;
    this.goal = goal;
  }
}

function describeArithmeticFailure(
  operation: ArithmeticKind,
  [left, right]: readonly [unknown, unknown],
): string {
  if (operation === "roundTo" || operation === "floorTo" || operation === "ceilTo") {
    return `${operation} expected numeric operands and a whole number of decimal places`;
  }
  if (operation === "daysBetween" || operation === "yearsBetween") {
    return `${operation} expected date operands`;
  }
  // Valid operands can still produce NaN (0 / 0) or an invalid date (a date minus Infinity).
  const operandsValid =
    (isNumber(left) || (operation === "sub" && isDate(left))) && isNumber(right);
  return operandsValid
    ? `${operation} produced NaN or an invalid date, which are not supported values`
    : `${operation} expected numeric operands`;
}

/** Rule body uses variables before any constructive source can bind them. */
export class UnsafeUnboundVariableProgrammerError extends ProgrammerError {
  /** The variables used before any constructive source could bind them. */
  readonly variables: readonly Variable[];

  constructor(variables: readonly Variable[]) {
    super(
      `Rule body uses unbound variable(s): ${variables.map((variable) => variable.name).join(", ")}`,
    );
    this.name = "UnsafeUnboundVariableProgrammerError";
    this.variables = variables;
  }
}

/** Recursive program structure outside the solver's constructive fragment. */
export class UnconstructiveRecursionProgrammerError extends ProgrammerError {
  constructor() {
    super("Program contains unconstructive recursion");
    this.name = "UnconstructiveRecursionProgrammerError";
  }
}

/** Predicate has a complete iff definition and additional competing rules. */
export class ExclusiveDefinitionProgrammerError extends ProgrammerError {
  /** The name of the predicate holding the exclusive `iff` definition. */
  readonly predicate: string;
  /** The competing rules that conflict with the `iff` definition. */
  readonly rules: readonly Rule[];

  constructor(predicate: string, rules: readonly Rule[]) {
    super(`Predicate has an iff definition and cannot have additional rules: ${predicate}`);
    this.name = "ExclusiveDefinitionProgrammerError";
    this.predicate = predicate;
    this.rules = rules;
  }
}

/**
 * A predicate cannot be classified over a supported finite domain. Raised when a classifier
 * registers the predicate, before any request is made.
 */
export class UnsupportedPredicateError extends ProgrammerError {
  /** Predicate whose registration failed. */
  readonly predicate: Predicate;
  /** Unsupported or invalid field, when the error concerns a specific field. */
  readonly field: string | undefined;

  constructor(message: string, predicate: Predicate, field?: string) {
    super(message);
    this.name = "UnsupportedPredicateError";
    this.predicate = predicate;
    this.field = field;
  }
}

/** What a conflicting name identifies. */
export type NameKind = "predicate" | "entity type" | "variable";

/**
 * Two different declarations share a name. Names identify predicates and
 * entity types (by class name) across a knowledge base, and variables within
 * a rule, so each name must denote exactly one thing.
 */
export class NameConflictProgrammerError extends ProgrammerError {
  /** What the name identifies. */
  readonly kind: NameKind;
  /** The shared name. */
  readonly conflictingName: string;

  constructor(kind: NameKind, conflictingName: string) {
    super(
      `Two different ${kind === "entity type" ? "entity classes" : `${kind}s`} are named ${JSON.stringify(conflictingName)}; a name must identify one ${kind}`,
    );
    this.name = "NameConflictProgrammerError";
    this.kind = kind;
    this.conflictingName = conflictingName;
  }
}

function isNumber(value: unknown): boolean {
  return typeof value === "number" || (isPlainObject(value) && value["kind"] === "number");
}

function isDate(value: unknown): boolean {
  return value instanceof Date || (isPlainObject(value) && value["kind"] === "date");
}
