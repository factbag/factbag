import { describe, expect, it } from "vitest";
import { and, closedPredicate, or, variable } from "../dsl";
import { solveQueryAll } from "./solve-all";

function closureProgram(relation: "ancestor" | "sibling") {
  const edge = closedPredicate("edge", { a: Number, b: Number });
  const closure = closedPredicate(relation, { a: Number, b: Number });
  const A = variable("A");
  const B = variable("B");
  const X = variable("X");
  const literals = Array.from({ length: 10 }, (_, a) => ({
    sign: "+" as const,
    atom: edge({ a, b: a + 1 }),
  }));
  const rules = [
    {
      kind: "iff" as const,
      head: { sign: "+" as const, atom: closure({ a: A, b: B }) },
      body: or(
        edge({ a: A, b: B }),
        ...(relation === "sibling" ? [edge({ a: B, b: A })] : []),
        and(closure({ a: A, b: X }), closure({ a: X, b: B })),
      ),
    },
  ];
  return { literals, rules, closure };
}

// This is an exponential-search regression guard, not a one-second latency SLA.
// CI runs cold workers alongside other packages: Node 26 took 1,041 ms for the
// correct ancestor result. Leave headroom without shrinking the ten-edge fixture.
const PERFORMANCE_BUDGET_MS = 5_000;

/** A time budget protects against enumerating exponentially many recursive proof paths. */
describe("solveQueryAll", () => {
  it.each(["ancestor", "sibling"] as const)(
    "answers a ground %s query over ten edges within the performance budget",
    { timeout: 10_000 },
    (relation) => {
      // Arrange
      const { literals, rules, closure } = closureProgram(relation);
      const atom = closure({ a: 0, b: 10 });

      // Act
      const start = performance.now();
      const result = solveQueryAll(literals, rules, atom);
      const elapsed = performance.now() - start;

      // Assert
      expect(result.map(({ value, goal }) => ({ value, goal }))).toEqual([
        { value: "true", goal: { kind: "atom", atom } },
      ]);
      expect(elapsed).toBeLessThan(PERFORMANCE_BUDGET_MS);
    },
  );

  it.each(["ancestor", "sibling"] as const)(
    "enumerates the %s closure over ten edges within the performance budget",
    { timeout: 10_000 },
    (relation) => {
      // Arrange
      const { literals, rules, closure } = closureProgram(relation);
      const atom = closure({ a: 0, b: variable("Target") });
      // Directed reachability gives 1..10; symmetry also gives the round trip to 0.
      const targets =
        relation === "ancestor"
          ? Array.from({ length: 10 }, (_, index) => index + 1)
          : Array.from({ length: 11 }, (_, index) => index);
      const expected = targets.map((b) => ({
        value: "true",
        goal: { kind: "atom", atom: closure({ a: 0, b }) },
      }));

      // Act
      const start = performance.now();
      const result = solveQueryAll(literals, rules, atom);
      const elapsed = performance.now() - start;

      // Assert
      const actual = result.map(({ value, goal }) => ({ value, goal }));
      actual.sort((left, right) => left.goal.atom.fields.b - right.goal.atom.fields.b);
      expect(actual).toEqual(expected);
      expect(elapsed).toBeLessThan(PERFORMANCE_BUDGET_MS);
    },
  );
});
