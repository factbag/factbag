import type { AnyAtom, Atom, GroundAtom } from "./atom";
import type { PredicateSchema } from "./schema";
import type { Var } from "./variable";
import type { Entity, Scalar, Term } from "../dsl/types";

/** A resolved value or variable used inside normalized rule goals. */
export type GoalExpression<Value = Scalar | Entity> = Term<Value>;

/** A normalized atom goal: evaluate an atom's goal value. */
export type AtomGoal<Schema extends PredicateSchema = PredicateSchema> = Readonly<{
  readonly kind: "atom";
  readonly atom: Atom<Schema>;
}>;

/** A normalized atom goal whose exact schema has been intentionally erased. */
export type AnyAtomGoal = Readonly<{
  readonly kind: "atom";
  readonly atom: AnyAtom;
}>;

/** A normalized atom goal whose atom is fully grounded. */
export type GroundAtomGoal<Schema extends PredicateSchema = PredicateSchema> = Readonly<{
  readonly kind: "atom";
  readonly atom: GroundAtom<Schema>;
}>;

/** Require explicit negative support for a goal. */
export type NotGoal = Readonly<{
  readonly kind: "not";
  readonly goal: Goal;
}>;

/** Prove every child goal. */
export type AndGoal = Readonly<{
  readonly kind: "and";
  readonly goals: readonly Goal[];
}>;

/** Prove at least one child goal. */
export type OrGoal = Readonly<{
  readonly kind: "or";
  readonly goals: readonly Goal[];
}>;

/** Existentially quantify variables for a child goal. */
export type ExistsGoal = Readonly<{
  readonly kind: "exists";
  readonly variables: readonly Var[];
  readonly goal: Goal;
}>;

/** Bind a variable to a value before proving a child goal. */
export type LetGoal = Readonly<{
  readonly kind: "let";
  readonly variable: Var;
  readonly value: GoalExpression;
  readonly goal: Goal;
}>;

/** Arithmetic goal binding the sum of two expressions. */
export type AddGoal = ArithmeticGoal<"add">;
/** Arithmetic goal binding the difference of two expressions. */
export type SubGoal = ArithmeticGoal<"sub">;
/** Arithmetic goal binding the product of two expressions. */
export type MulGoal = ArithmeticGoal<"mul">;
/** Arithmetic goal binding the quotient of two expressions. */
export type DivGoal = ArithmeticGoal<"div">;
/** Arithmetic goal binding the whole calendar days from the right date to the left. */
export type DaysBetweenGoal = ArithmeticGoal<"daysBetween">;
/** Arithmetic goal binding the whole calendar years from the right date to the left. */
export type YearsBetweenGoal = ArithmeticGoal<"yearsBetween">;

/** The primitive arithmetic operations. */
export type ArithmeticKind = "add" | "sub" | "mul" | "div" | "daysBetween" | "yearsBetween";

/** Bind the result of a primitive arithmetic operation. */
export type ArithmeticGoal<Kind extends ArithmeticKind> = Readonly<{
  readonly kind: Kind;
  readonly bind: Var;
  readonly left: GoalExpression<Scalar>;
  readonly right: GoalExpression<Scalar>;
}>;

/** Comparison goal requiring the operands to be equal. */
export type EqGoal = ComparisonGoal<"eq">;
/** Comparison goal requiring the operands to differ. */
export type NeqGoal = ComparisonGoal<"neq">;
/** Comparison goal requiring the left operand to be strictly less than the right. */
export type LtGoal = ComparisonGoal<"lt">;
/** Comparison goal requiring the left operand to be at most the right. */
export type LteGoal = ComparisonGoal<"lte">;
/** Comparison goal requiring the left operand to be strictly greater than the right. */
export type GtGoal = ComparisonGoal<"gt">;
/** Comparison goal requiring the left operand to be at least the right. */
export type GteGoal = ComparisonGoal<"gte">;

/** Compare two value-producing expressions. */
export type ComparisonGoal<Kind extends "eq" | "neq" | "lt" | "lte" | "gt" | "gte"> = Readonly<{
  readonly kind: Kind;
  readonly left: GoalExpression;
  readonly right: GoalExpression;
}>;

/** Sum a numeric expression over rows matched by a body goal. */
export type SumGoal = Readonly<{
  readonly kind: "sum";
  readonly bind: Var;
  readonly value: GoalExpression<number | bigint>;
  readonly where: Goal;
  readonly completeWhen?: Goal;
}>;

/** Count rows matched by a body goal. */
export type CountGoal = Readonly<{
  readonly kind: "count";
  readonly bind: Var;
  readonly where: Goal;
  readonly completeWhen?: Goal;
}>;

/** A normalized rule-body target that the solver/proof system can evaluate. */
export type Goal =
  | AnyAtomGoal
  | NotGoal
  | AndGoal
  | OrGoal
  | ExistsGoal
  | LetGoal
  | AddGoal
  | SubGoal
  | MulGoal
  | DivGoal
  | DaysBetweenGoal
  | YearsBetweenGoal
  | EqGoal
  | NeqGoal
  | LtGoal
  | LteGoal
  | GtGoal
  | GteGoal
  | SumGoal
  | CountGoal;

/** A goal evaluated by recursively evaluating one or more child goals. */
export type CompoundGoal = NotGoal | AndGoal | OrGoal | ExistsGoal | LetGoal;

/** A goal evaluated directly by a primitive operator. */
export type PrimitiveGoal =
  | AddGoal
  | SubGoal
  | MulGoal
  | DivGoal
  | DaysBetweenGoal
  | YearsBetweenGoal
  | EqGoal
  | NeqGoal
  | LtGoal
  | LteGoal
  | GtGoal
  | GteGoal
  | SumGoal
  | CountGoal;
