/** §2. Definitions and special rules: surviving spouse (a) and head of household (b). */
import {
  and,
  closedPredicate,
  gt,
  gte,
  letIn,
  lte,
  not,
  or,
  sub,
  variable,
} from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { died, legally_separated, Person, year_bounds } from "../schema";
import { died_during, marriage, married_at, nra_during } from "./helpers";

const T = variable("T");
const S = variable("S");
const S1 = variable("S1");
const S2 = variable("S2");
const A = variable("A");
const B = variable("B");
const Y = variable("Y");
const Y1 = variable("Y1");
const Y2 = variable("Y2");
const F = variable("F");
const L = variable("L");
const F1 = variable("F1");
const L1 = variable("L1");
const F2 = variable("F2");
const L2 = variable("L2");
const U = variable("U");
const U1 = variable("U1");
const U2 = variable("U2");
const D = variable("D");
const D1 = variable("D1");
const D2 = variable("D2");
const K = variable("K");

/** (a)(1)(A): the taxpayer's spouse died during either of the two years before the taxable year. */
export const s2_a_1_A = closedPredicate("s2_a_1_A", { taxpayer: Person, year: BigInt });

/** (a)(2)(A): the taxpayer has remarried at any time before the close of the taxable year. */
export const s2_a_2_A = closedPredicate("s2_a_2_A", { taxpayer: Person, year: BigInt });

/**
 * (a)(2)(B): a joint return could have been made for the taxable year, which is to say
 * neither the taxpayer nor the spouse was a nonresident alien at any time during it.
 */
export const s2_a_2_B = closedPredicate("s2_a_2_B", { taxpayer: Person, year: BigInt });

/** (b)(2)(A): the two are legally separated under a decree of divorce or of separate maintenance by the close of the year. */
export const s2_b_2_A = closedPredicate("s2_b_2_A", { a: Person, b: Person, year: BigInt });

/** (b)(2)(B): the taxpayer's spouse is a nonresident alien at some time during the taxable year. */
export const s2_b_2_B = closedPredicate("s2_b_2_B", { taxpayer: Person, year: BigInt });

/** (b)(2)(C): the taxpayer's spouse, other than one described in (B), died during the taxable year. */
export const s2_b_2_C = closedPredicate("s2_b_2_C", { taxpayer: Person, year: BigInt });

export function defineS2(kb: KnowledgeBase): void {
  kb.rule(s2_a_1_A({ taxpayer: T, year: Y })).iff(
    and(
      letIn(Y2, sub(Y, 2n), year_bounds({ year: Y2, first: F2, last: L2, under25After: U2 })),
      letIn(Y1, sub(Y, 1n), year_bounds({ year: Y1, first: F1, last: L1, under25After: U1 })),
      died({ person: S, day: D }),
      gte(D, F2),
      lte(D, L1),
      married_at({ a: T, b: S, day: D }),
    ),
  );
  kb.rule(s2_a_2_A({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L, under25After: U }),
      marriage({ a: T, b: S1, start: D1 }),
      marriage({ a: T, b: S2, start: D2 }),
      gt(D2, D1),
      lte(D2, L),
    ),
  );
  kb.rule(s2_a_2_B({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L, under25After: U }),
      marriage({ a: T, b: S, start: D }),
      not(nra_during({ person: T, first: F, last: L })),
      not(nra_during({ person: S, first: F, last: L })),
    ),
  );
  kb.rule(s2_b_2_A({ a: A, b: B, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L, under25After: U }),
      or(
        and(legally_separated({ a: A, b: B, decree: K, day: D }), lte(D, L)),
        and(legally_separated({ a: B, b: A, decree: K, day: D }), lte(D, L)),
      ),
    ),
  );
  kb.rule(s2_b_2_B({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L, under25After: U }),
      marriage({ a: T, b: S, start: D }),
      nra_during({ person: S, first: F, last: L }),
    ),
  );
  kb.rule(s2_b_2_C({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L, under25After: U }),
      marriage({ a: T, b: S, start: D }),
      not(nra_during({ person: S, first: F, last: L })),
      died_during({ person: S, first: F, last: L }),
    ),
  );
}
