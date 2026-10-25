import type { ArithmeticGoal, ArithmeticKind } from "../types/goal";
import type { PredicateDeclaration } from "../types/predicate";
import type { AnyRule } from "../types/rule";
import type { Var } from "../types/variable";

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
  readonly goal: ArithmeticGoal<ArithmeticKind>;

  constructor(
    operation: ArithmeticKind,
    operands: readonly [unknown, unknown],
    goal: ArithmeticGoal<ArithmeticKind>,
  ) {
    const rounding = operation === "roundTo" || operation === "floorTo" || operation === "ceilTo";
    super(
      `${operation} expected ${operation === "daysBetween" || operation === "yearsBetween" ? "date" : "numeric"} operands${rounding ? " and a whole number of decimal places" : ""}`,
    );
    this.name = "PrimitiveArithmeticProgrammerError";
    this.operation = operation;
    this.operands = operands;
    this.goal = goal;
  }
}

/** Rule body uses variables before any constructive source can bind them. */
export class UnsafeUnboundVariableProgrammerError extends ProgrammerError {
  /** The variables used before any constructive source could bind them. */
  readonly variables: readonly Var[];

  constructor(variables: readonly Var[]) {
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
  /** The predicate holding the exclusive `iff` definition. */
  readonly predicate: PredicateDeclaration;
  /** The competing rules that conflict with the `iff` definition. */
  readonly rules: readonly AnyRule[];

  constructor(predicate: PredicateDeclaration, rules: readonly AnyRule[]) {
    super(`Predicate has an iff definition and cannot have additional rules: ${predicate.name}`);
    this.name = "ExclusiveDefinitionProgrammerError";
    this.predicate = predicate;
    this.rules = rules;
  }
}
