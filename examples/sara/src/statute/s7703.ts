/** §7703. Determination of marital status. */
import { and, closedPredicate, gte, lte, not, or, variable } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { died, legally_separated, Person, year_bounds } from "../schema";
import { married_at } from "./helpers";

const T = variable("T");
const S = variable("S");
const Y = variable("Y");
const F = variable("F");
const L = variable("L");
const D = variable("D");
const U = variable("U");
const K = variable("K");

/**
 * (a)(1): the taxpayer and spouse are married as of the close of the taxable year, or, if
 * the spouse died during the year, as of the time of death.
 */
export const s7703_a_1 = closedPredicate("s7703_a_1", {
  taxpayer: Person,
  spouse: Person,
  year: BigInt,
});

/**
 * (a)(2): by the close of the year the taxpayer is legally separated from a spouse under a
 * decree of divorce or of separate maintenance.
 */
export const s7703_a_2 = closedPredicate("s7703_a_2", { taxpayer: Person, year: BigInt });

/** (a): married within the meaning of subsection (a): (a)(1) holds and (a)(2) does not. */
const s7703_a = closedPredicate("s7703_a", {
  taxpayer: Person,
  spouse: Person,
  year: BigInt,
});

export function defineS7703(kb: KnowledgeBase): void {
  kb.rule(s7703_a_1({ taxpayer: T, spouse: S, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L, under25After: U }),
      or(
        // The spouse died during the year: decide as of the day of death.
        and(died({ person: S, day: D }), gte(D, F), lte(D, L), married_at({ a: T, b: S, day: D })),
        // Otherwise as of the close of the year.
        married_at({ a: T, b: S, day: L }),
      ),
    ),
  );
  kb.rule(s7703_a_2({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L, under25After: U }),
      or(
        and(legally_separated({ a: T, b: S, decree: K, day: D }), lte(D, L)),
        and(legally_separated({ a: S, b: T, decree: K, day: D }), lte(D, L)),
      ),
    ),
  );
  kb.rule(s7703_a({ taxpayer: T, spouse: S, year: Y })).iff(
    and(s7703_a_1({ taxpayer: T, spouse: S, year: Y }), not(s7703_a_2({ taxpayer: T, year: Y }))),
  );
}
