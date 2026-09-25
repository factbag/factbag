/**
 * Asserts the single-query wrapper delegates to solveQueryAll, requires a
 * ground query atom, and returns unknown when no solution is available.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { predicate } from "../dsl";
import { assertGroundAtom } from "../types/atom";
import type { Atom } from "../types/atom";
import type { QueryJudgment } from "../types/judgment";
import type { PredicateSchema } from "../types/schema";
import { solveQuery } from "./solve";
import { solveQueryAll } from "./solve-all";

vi.mock("./solve-all", () => ({
  solveQueryAll: vi.fn(),
}));

class Person {
  constructor(readonly id: string) {}
}

function unknownResult<Schema extends PredicateSchema>(atom: Atom<Schema>): QueryJudgment {
  assertGroundAtom(atom);
  return { value: "unknown", goal: { kind: "atom", atom }, bindings: [] };
}

describe("solveQuery", () => {
  beforeEach(() => {
    vi.mocked(solveQueryAll).mockReset();
  });

  it("returns the only result from solveQueryAll", () => {
    const alice = new Person("alice");
    const doctor = predicate("doctor", { person: Person });
    const atom = doctor({ person: alice });
    const result = unknownResult(atom);
    vi.mocked(solveQueryAll).mockReturnValue([result]);
    assertGroundAtom(atom);

    expect(solveQuery([], [], atom)).toBe(result);
    expect(solveQueryAll).toHaveBeenCalledWith([], [], atom);
  });

  it("asserts that solveQueryAll returns a result for a ground atom", () => {
    const alice = new Person("alice");
    const doctor = predicate("doctor", { person: Person });
    const atom = doctor({ person: alice });
    vi.mocked(solveQueryAll).mockReturnValue([]);
    assertGroundAtom(atom);

    expect(() => solveQuery([], [], atom)).toThrow("Ground query must produce one result");
  });
});
