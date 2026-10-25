import { expect } from "vitest";
import type { QueryJudgment } from "../../src/query";
import type { GroundAtom } from "../../src/types/atom";
import type { AnyRule } from "../../src/types/rule";

/** Check rule support and semantic bindings without fixing arithmetic temporary names. */
export function ruleProof(
  atom: GroundAtom,
  value: "true" | "false",
  rule: AnyRule,
  bindings: QueryJudgment["bindings"],
): QueryJudgment {
  const body: unknown = expect.objectContaining({
    value,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Partial bindings deliberately allow unrelated arithmetic temporaries.
    bindings: expect.arrayContaining([...bindings]),
  });
  const support: unknown = expect.arrayContaining([{ source: "rule", rule, body }]);
  // oxlint-disable-next-line typescript/no-unsafe-return -- The DSL runner evaluates asymmetric proof expectations.
  return expect.objectContaining({
    value,
    goal: { kind: "atom", atom },
    bindings: [],
    [value === "false" ? "negative" : "positive"]: support,
  });
}
