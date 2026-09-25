/**
 * Asserts that programmer errors identify invalid caller-supplied program logic
 * and that primitive arithmetic errors retain operation, operands, and goal.
 */
import { describe, expect, it } from "vitest";
import { predicate } from "../dsl";
import { Var } from "../types/variable";
import {
  ExclusiveDefinitionProgrammerError,
  PrimitiveArithmeticProgrammerError,
  ProgrammerError,
  UnsafeUnboundVariableProgrammerError,
  UnconstructiveRecursionProgrammerError,
} from "./programmer-errors";

describe("programmer errors", () => {
  it("names generic programmer errors", () => {
    const error = new ProgrammerError("Invalid ruleset");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ProgrammerError");
    expect(error.message).toBe("Invalid ruleset");
  });

  it("describes primitive arithmetic programmer errors", () => {
    const Total = new Var("Total");
    const goal = { kind: "add", bind: Total, left: 1, right: "nope" } as const;
    const error = new PrimitiveArithmeticProgrammerError("add", [1, "nope"], goal);

    expect(error).toBeInstanceOf(ProgrammerError);
    expect(error.name).toBe("PrimitiveArithmeticProgrammerError");
    expect(error.message).toBe("add expected numeric operands");
    expect(error.operation).toBe("add");
    expect(error.operands).toEqual([1, "nope"]);
    expect(error.goal).toBe(goal);
  });

  it("describes unsafe unbound variable programmer errors", () => {
    const Score = new Var("Score");
    const error = new UnsafeUnboundVariableProgrammerError([Score]);

    expect(error).toBeInstanceOf(ProgrammerError);
    expect(error.name).toBe("UnsafeUnboundVariableProgrammerError");
    expect(error.message).toBe("Rule body uses unbound variable(s): Score");
    expect(error.variables).toEqual([Score]);
  });

  it("describes unconstructive recursion programmer errors", () => {
    const error = new UnconstructiveRecursionProgrammerError();

    expect(error).toBeInstanceOf(ProgrammerError);
    expect(error.name).toBe("UnconstructiveRecursionProgrammerError");
    expect(error.message).toBe("Program contains unconstructive recursion");
  });

  it("describes exclusive definition programmer errors", () => {
    const eligible = predicate("eligible", {});
    const rule = { kind: "iff", head: { sign: "+", atom: eligible({}) }, body: {} } as const;
    const rules = [rule];
    const error = new ExclusiveDefinitionProgrammerError(eligible, rules);

    expect(error).toBeInstanceOf(ProgrammerError);
    expect(error.name).toBe("ExclusiveDefinitionProgrammerError");
    expect(error.message).toBe(
      "Predicate has an iff definition and cannot have additional rules: eligible",
    );
    expect(error.predicate).toBe(eligible);
    expect(error.rules).toBe(rules);
  });
});
