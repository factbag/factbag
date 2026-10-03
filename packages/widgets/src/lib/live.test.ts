/**
 * Pins the scaffold helper to the solver's lattice semantics: every widget
 * value routed through solveScaffold rests on these round trips.
 */
import { describe, expect, expectTypeOf, it } from "vitest";

import type { GoalValue } from "@factbag/core/query";

import { solveScaffold } from "./live";

describe("solveScaffold", () => {
  it("returns every required leaf and gate with their exact key union", () => {
    const values = solveScaffold([{ id: "gate", inputs: ["leaf"], operator: "and" }] as const, {
      leaf: "true",
    });

    expectTypeOf(values).toEqualTypeOf<Record<"leaf" | "gate", GoalValue>>();
    expect(values).toEqual({ gate: "true", leaf: "true" });
  });

  it("round-trips leaf values through filings: assert, deny, both, silence", () => {
    const values = solveScaffold([], {
      both: "conflicted",
      denied: "false",
      filed: "true",
      silent: "unknown",
    });
    expect(values).toEqual({
      both: "conflicted",
      denied: "false",
      filed: "true",
      silent: "unknown",
    });
  });

  it("evaluates AND as the weakest input on the value order", () => {
    const values = solveScaffold([{ id: "h", inputs: ["a", "b", "c", "d"], operator: "and" }], {
      a: "true",
      b: "unknown",
      c: "true",
      d: "conflicted",
    });
    expect(values.h).toBe("unknown");
  });

  it("evaluates OR as the strongest input on the value order", () => {
    const values = solveScaffold([{ id: "h", inputs: ["a", "b", "c"], operator: "or" }], {
      a: "false",
      b: "unknown",
      c: "conflicted",
    });
    expect(values.h).toBe("conflicted");
  });

  it("chains gates through intermediate heads", () => {
    const values = solveScaffold(
      [
        { id: "identity", inputs: ["registry", "taxId"], operator: "and" },
        { id: "compliance", inputs: ["audit", "sanctions"], operator: "and" },
        { id: "risk", inputs: ["compliance", "insurance"], operator: "or" },
        { id: "root", inputs: ["identity", "risk"], operator: "and" },
      ],
      {
        audit: "unknown",
        insurance: "conflicted",
        registry: "true",
        sanctions: "unknown",
        taxId: "unknown",
      },
    );
    expect(values.identity).toBe("unknown");
    expect(values.compliance).toBe("unknown");
    expect(values.risk).toBe("conflicted");
    expect(values.root).toBe("unknown");
  });
});
