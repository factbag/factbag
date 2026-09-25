import type { GoalValue } from "../types/common";
import { AssertionError } from "../utils/assert";

const GOAL_VALUE_RANK: Record<GoalValue, 0 | 1 | 2 | 3> = {
  false: 0,
  unknown: 1,
  conflicted: 2,
  true: 3,
};

const GOAL_VALUES_BY_RANK: readonly GoalValue[] = ["false", "unknown", "conflicted", "true"];

export function rankGoalValue(value: GoalValue): 0 | 1 | 2 | 3 {
  return GOAL_VALUE_RANK[value];
}

export function minGoalValue(...values: readonly GoalValue[]): GoalValue {
  if (values.length === 0) {
    return "true";
  }

  let rank = 3;
  for (const value of values) {
    rank = Math.min(rank, rankGoalValue(value));
  }

  return goalValueByRank(rank);
}

export function maxGoalValue(...values: readonly GoalValue[]): GoalValue {
  if (values.length === 0) {
    return "false";
  }

  let rank = 0;
  for (const value of values) {
    rank = Math.max(rank, rankGoalValue(value));
  }

  return goalValueByRank(rank);
}

export function negateGoalValue(value: GoalValue): GoalValue {
  switch (value) {
    case "true":
      return "false";
    case "false":
      return "true";
    case "unknown":
      return "unknown";
    case "conflicted":
      return "conflicted";
    default:
      throw new AssertionError("Unhandled goal value");
  }
}

export function negateAsFailureGoalValue(value: GoalValue): GoalValue {
  switch (value) {
    case "true":
      return "false";
    case "false":
      return "true";
    case "unknown":
      return "true";
    case "conflicted":
      return "conflicted";
    default:
      throw new AssertionError("Unhandled goal value");
  }
}

function goalValueByRank(rank: number): GoalValue {
  const value = GOAL_VALUES_BY_RANK[rank];
  if (value === undefined) {
    throw new Error(`Invalid goal value rank: ${rank}`);
  }
  return value;
}
