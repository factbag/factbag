import type { GroundAtom } from "@factbag/core/dsl";
import type { Scenario } from "../types";
import { createHaystackCorpus } from "./corpus";
import { chain, createHaystackKB } from "./kb";

export { createHaystackScenario as default };

/**
 * The sanctions question with the ownership chain stretched to four links and buried in
 * unrelated corporate paperwork. Every link needs its own evidence: drop one certificate and
 * the prohibition no longer follows.
 */
export function createHaystackScenario(): Scenario & ReturnType<typeof createHaystackKB> {
  const base = createHaystackKB();
  const { corpus, targets } = createHaystackCorpus(base);
  const { blocked, prohibited } = base.predicates;
  const blockedParties: readonly GroundAtom[] = [...chain, base.entities.ural].map((party) =>
    blocked({ party }),
  );
  return {
    ...base,
    corpus,
    targets,
    expected: [
      ...targets.map((atom) => ({ atom, value: "true" as const })),
      ...blockedParties.map((atom) => ({ atom, value: "true" as const })),
      { atom: prohibited({ transaction: base.entities.transaction }), value: "true" },
    ],
  };
}
