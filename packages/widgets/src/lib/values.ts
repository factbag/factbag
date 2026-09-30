/**
 * The four-valued lattice's order, ⊥ < ? < ! < ⊤, for laying widgets out and
 * cycling leaf values under the reader's taps. Every displayed value comes
 * from the solver, so no lattice arithmetic lives here. Display metadata is
 * in `../theme` (VERDICT), shared with the proof tree renderer.
 */

export type GoalValue = "false" | "unknown" | "conflicted" | "true";
export type Operator = "and" | "or";

/** The lattice, ordered weakest to strongest. */
export const VALUES: readonly GoalValue[] = ["false", "unknown", "conflicted", "true"];

export const RANK: Record<GoalValue, 0 | 1 | 2 | 3> = {
  false: 0,
  unknown: 1,
  conflicted: 2,
  true: 3,
};

export function cycleValue(value: GoalValue, direction: 1 | -1): GoalValue {
  const index = (VALUES.indexOf(value) + direction + VALUES.length) % VALUES.length;

  return VALUES[index] ?? value;
}

export function formatNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }

  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1] ?? ""}`;
}
