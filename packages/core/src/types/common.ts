import type { Var } from "./variable";

/** Four-valued result for an evaluated proposition or goal. */
export type GoalValue = "false" | "unknown" | "conflicted" | "true";

/** One variable assignment in scope for an evaluated goal. */
export type Binding = readonly [variable: Var, value: unknown];

/** Ordered variable assignments in scope for an evaluated goal. */
export type Bindings = readonly Binding[];
