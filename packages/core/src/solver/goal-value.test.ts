/**
 * Asserts the goal-value lattice ordering and truth-table behavior used by
 * conjunction, disjunction, explicit negation, and negation-as-failure.
 */
import { describe, expect, it } from "vitest";
import {
  maxGoalValue,
  minGoalValue,
  negateAsFailureGoalValue,
  negateGoalValue,
  rankGoalValue,
} from "./goal-value";

describe("goal value lattice", () => {
  it("orders values as false < unknown < conflicted < true", () => {
    expect(rankGoalValue("false")).toBeLessThan(rankGoalValue("unknown"));
    expect(rankGoalValue("unknown")).toBeLessThan(rankGoalValue("conflicted"));
    expect(rankGoalValue("conflicted")).toBeLessThan(rankGoalValue("true"));
  });

  it("uses minimum for conjunction", () => {
    expect(minGoalValue("true", "conflicted", "unknown")).toBe("unknown");
    expect(minGoalValue("true", "false")).toBe("false");
    expect(minGoalValue()).toBe("true");
  });

  it("uses maximum for disjunction", () => {
    expect(maxGoalValue("false", "unknown", "conflicted")).toBe("conflicted");
    expect(maxGoalValue("false", "true")).toBe("true");
    expect(maxGoalValue()).toBe("false");
  });

  it("negates explicit support values", () => {
    expect(negateGoalValue("true")).toBe("false");
    expect(negateGoalValue("false")).toBe("true");
    expect(negateGoalValue("unknown")).toBe("unknown");
    expect(negateGoalValue("conflicted")).toBe("conflicted");
  });

  it("negates closed-world failure values", () => {
    expect(negateAsFailureGoalValue("true")).toBe("false");
    expect(negateAsFailureGoalValue("false")).toBe("true");
    expect(negateAsFailureGoalValue("unknown")).toBe("true");
    expect(negateAsFailureGoalValue("conflicted")).toBe("conflicted");
  });
});
