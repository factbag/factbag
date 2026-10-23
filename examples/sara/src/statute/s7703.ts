/** §7703. Determination of marital status. */
import { and, closedPredicate, lte, not, or, variable } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { legally_separated, married_stated, Person, year_bounds, year_marks } from "../schema";
import {
  abode_over_half,
  child_incl_step,
  cohabited_during,
  files_separately,
  maintained_home_in,
  maintains_household,
  spouse_at_close,
} from "./helpers";
import { s151_c } from "./s151";

const T = variable("T");
const S = variable("S");
const C = variable("C");
const Y = variable("Y");
const F = variable("F");
const L = variable("L");
const D = variable("D");
const K = variable("K");
const J = variable("J");
const H = variable("H");

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
/** (a): married within the meaning of subsection (a) to the spouse: (a)(1) and not (a)(2). */
export const s7703_a = closedPredicate("s7703_a", {
  taxpayer: Person,
  spouse: Person,
  year: BigInt,
});
/** Married within the meaning of subsection (a) to someone. */
const married_a = closedPredicate("married_a", { taxpayer: Person, year: BigInt });
/**
 * (b)(1): married within (a), files a separate return, and maintains as home a household
 * that is for more than half the year the principal place of abode of a child for whom a
 * §151 deduction is allowed.
 */
export const s7703_b_1 = closedPredicate("s7703_b_1", { taxpayer: Person, year: BigInt });
/** (b)(2): the taxpayer furnishes over half the cost of maintaining the household. */
export const s7703_b_2 = closedPredicate("s7703_b_2", { taxpayer: Person, year: BigInt });
/** (b)(3): the spouse is not a member of the household during the last six months. */
export const s7703_b_3 = closedPredicate("s7703_b_3", { taxpayer: Person, year: BigInt });
/** (b): all three hold, so the taxpayer is not considered married. */
export const s7703_b = closedPredicate("s7703_b", { taxpayer: Person, year: BigInt });
/**
 * Married for the year as §7703 determines it: married within (a) and not living apart
 * under (b), or stated outright by the text.
 */
export const married_7703 = closedPredicate("married_7703", { taxpayer: Person, year: BigInt });

export function defineS7703(kb: KnowledgeBase): void {
  kb.rule(s7703_a_1({ taxpayer: T, spouse: S, year: Y })).iff(
    spouse_at_close({ taxpayer: T, spouse: S, year: Y }),
  );
  kb.rule(s7703_a_2({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      or(
        and(legally_separated({ a: T, b: S, decree: K, day: D }), lte(D, L)),
        and(legally_separated({ a: S, b: T, decree: K, day: D }), lte(D, L)),
      ),
    ),
  );
  kb.rule(s7703_a({ taxpayer: T, spouse: S, year: Y })).iff(
    and(s7703_a_1({ taxpayer: T, spouse: S, year: Y }), not(s7703_a_2({ taxpayer: T, year: Y }))),
  );
  kb.rule(married_a({ taxpayer: T, year: Y })).iff(s7703_a({ taxpayer: T, spouse: S, year: Y }));
  kb.rule(s7703_b_1({ taxpayer: T, year: Y })).iff(
    and(
      married_a({ taxpayer: T, year: Y }),
      files_separately({ person: T, year: Y }),
      maintained_home_in({ person: T, year: Y }),
      child_incl_step({ child: C, parent: T }),
      abode_over_half({ a: T, b: C, year: Y }),
      s151_c({ taxpayer: T, dependent: C, year: Y }),
    ),
  );
  kb.rule(s7703_b_2({ taxpayer: T, year: Y })).iff(maintains_household({ person: T, year: Y }));
  kb.rule(s7703_b_3({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      year_marks({ year: Y, julyFirst: J, halfDays: H }),
      s7703_a({ taxpayer: T, spouse: S, year: Y }),
      not(cohabited_during({ a: T, b: S, first: J, last: L })),
    ),
  );
  kb.rule(s7703_b({ taxpayer: T, year: Y })).iff(
    and(
      s7703_b_1({ taxpayer: T, year: Y }),
      s7703_b_2({ taxpayer: T, year: Y }),
      s7703_b_3({ taxpayer: T, year: Y }),
    ),
  );
  kb.rule(married_7703({ taxpayer: T, year: Y })).iff(
    or(
      married_stated.undated({ person: T }),
      married_stated.inYear({ person: T, year: Y }),
      and(married_a({ taxpayer: T, year: Y }), not(s7703_b({ taxpayer: T, year: Y }))),
    ),
  );
}
