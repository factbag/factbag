import type { GroundAtom } from "@factbag/core/dsl";
import type { Scenario } from "../types";
import { createOfacCorpus } from "./corpus";
import { createOfacKB } from "./kb";

export { createOfacScenario as default };

/** A fixed ownership-chain case from the imported abstract sanctions benchmark. */
export function createOfacScenario(): Scenario & ReturnType<typeof createOfacKB> {
  const base = createOfacKB();
  const { corpus, targets } = createOfacCorpus(base);
  return { ...base, corpus, targets, expected: ofacExpectations(base, targets) };
}

/** Every extraction target holds, and the chain they feed derives the prohibition. */
export function ofacExpectations(
  { entities, predicates }: ReturnType<typeof createOfacKB>,
  targets: readonly GroundAtom[],
): Scenario["expected"] {
  return [
    ...targets.map((atom) => ({ atom, value: "true" as const })),
    { atom: predicates.blocked({ party: entities.ural }), value: "true" },
    { atom: predicates.prohibited({ transaction: entities.transaction }), value: "true" },
  ];
}
