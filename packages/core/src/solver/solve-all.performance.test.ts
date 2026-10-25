import { describe, expect, it } from "vitest";
import { and, closedPredicate, variable } from "../dsl";
import type { AnyRule } from "../types/rule";
import { solveQueryAll } from "./solve-all";

describe("solveQueryAll", () => {
  it("answers a ground query over hundreds of layered predicates in under a second", () => {
    // Arrange
    const base = closedPredicate("layer_0", { value: Number });
    const Value = variable("Value");
    const rules: AnyRule[] = [];
    let previous = base;
    for (let index = 1; index < 300; index += 1) {
      const layer = closedPredicate(`layer_${index}`, { value: Number });
      rules.push({
        kind: "iff",
        head: { sign: "+", atom: layer({ value: Value }) },
        body: previous({ value: Value }),
      });
      previous = layer;
    }
    const literals = [{ sign: "+", atom: base({ value: 7 }) }] as const;
    const atom = previous({ value: 7 });

    // Act
    const start = performance.now();
    const result = solveQueryAll(literals, rules, atom);
    const elapsed = performance.now() - start;

    // Assert
    expect(result.map(({ value, goal }) => ({ value, goal }))).toEqual([
      { value: "true", goal: { kind: "atom", atom } },
    ]);
    expect(elapsed).toBeLessThan(1000);
  });

  it("reuses shared dependencies while discovering candidates through layered diamonds", () => {
    // Arrange
    const base = closedPredicate("base", { value: Number });
    const Value = variable("Value");
    const rules: AnyRule[] = [];
    let previous = [base, base] as const;
    for (let layer = 0; layer < 16; layer += 1) {
      const next = [
        closedPredicate(`left_${layer}`, { value: Number }),
        closedPredicate(`right_${layer}`, { value: Number }),
      ] as const;
      for (const predicate of next) {
        rules.push({
          kind: "iff",
          head: { sign: "+", atom: predicate({ value: Value }) },
          body: and(previous[0]({ value: Value }), previous[1]({ value: Value })),
        });
      }
      previous = next;
    }
    const literals = [{ sign: "+", atom: base({ value: 7 }) }] as const;
    const atom = previous[0]({ value: Value });

    // Act
    const start = performance.now();
    const result = solveQueryAll(literals, rules, atom);
    const elapsed = performance.now() - start;

    // Assert
    expect(result.map(({ value, goal }) => ({ value, goal }))).toEqual([
      { value: "true", goal: { kind: "atom", atom: previous[0]({ value: 7 }) } },
    ]);
    expect(elapsed).toBeLessThan(1000);
  });
});
