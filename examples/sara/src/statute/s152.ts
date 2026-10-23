/**
 * §152. Dependent defined: the qualifying child tests of subsection (c) and the qualifying
 * relative relationships of subsection (d)(2).
 */
import { and, closedPredicate, gt, gte, lte, not, or, variable } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { born, child_of, Person, year_bounds } from "../schema";
import {
  child_incl_step,
  cohabited_in,
  descendant_of,
  has_birth,
  marriage,
  married_at,
  sibling,
  spouses,
  stepparent_of,
} from "./helpers";

const I = variable("I");
const T = variable("T");
const S = variable("S");
const Y = variable("Y");
const F = variable("F");
const L = variable("L");
const U = variable("U");
const BI = variable("BI");
const BT = variable("BT");
const C = variable("C");
const P = variable("P");
const W = variable("W");
const M = variable("M");

const relation = { individual: Person, taxpayer: Person };

/** (d)(2)(A): a child of the taxpayer, or a descendant of a child. */
export const s152_d_2_A = closedPredicate("s152_d_2_A", relation);
/** (d)(2)(B): a brother, sister, stepbrother or stepsister. */
export const s152_d_2_B = closedPredicate("s152_d_2_B", relation);
/** (d)(2)(C): the father or mother, or an ancestor of either. */
export const s152_d_2_C = closedPredicate("s152_d_2_C", relation);
/** (d)(2)(D): a stepfather or stepmother. */
export const s152_d_2_D = closedPredicate("s152_d_2_D", relation);
/** (d)(2)(E): a son or daughter of a brother or sister of the taxpayer. */
export const s152_d_2_E = closedPredicate("s152_d_2_E", relation);
/** (d)(2)(F): a brother or sister of the father or mother of the taxpayer. */
export const s152_d_2_F = closedPredicate("s152_d_2_F", relation);
/** (d)(2)(G): a son-, daughter-, father-, mother-, brother- or sister-in-law. */
export const s152_d_2_G = closedPredicate("s152_d_2_G", relation);
/**
 * (d)(2)(H): a member of the taxpayer's household for the year, sharing the taxpayer's
 * principal place of abode, who was not the taxpayer's spouse at any time in the year.
 */
export const s152_d_2_H = closedPredicate("s152_d_2_H", { ...relation, year: BigInt });
/** (d)(2): any of the relationships (A) to (H), for the year. */
export const s152_d_2 = closedPredicate("s152_d_2", { ...relation, year: BigInt });
/** The individual was the taxpayer's spouse at some time during the year. */
const spouse_during = closedPredicate("spouse_during", { ...relation, year: BigInt });

/** (c)(2)(A): the individual is a child of the taxpayer or a descendant of such a child. */
export const s152_c_2_A = closedPredicate("s152_c_2_A", { individual: Person, taxpayer: Person });

/** (c)(2)(B): the individual is a sibling of the taxpayer or a descendant of such a sibling. */
export const s152_c_2_B = closedPredicate("s152_c_2_B", { individual: Person, taxpayer: Person });

/** (c)(2): the individual bears one of the relationships to the taxpayer. */
export const s152_c_2 = closedPredicate("s152_c_2", { individual: Person, taxpayer: Person });

/**
 * (c)(3): the individual is younger than the taxpayer and under 25 at the close of the
 * year. SARA treats a descendant with no stated date of birth as meeting the test.
 */
export const s152_c_3 = closedPredicate("s152_c_3", {
  individual: Person,
  taxpayer: Person,
  year: BigInt,
});

export function defineS152(kb: KnowledgeBase): void {
  kb.rule(s152_d_2_A({ individual: I, taxpayer: T })).iff(
    or(
      child_incl_step({ child: I, parent: T }),
      and(child_incl_step({ child: C, parent: T }), descendant_of({ descendant: I, ancestor: C })),
    ),
  );
  kb.rule(s152_d_2_B({ individual: I, taxpayer: T })).iff(sibling({ a: I, b: T }));
  kb.rule(s152_d_2_C({ individual: I, taxpayer: T })).iff(
    descendant_of({ descendant: T, ancestor: I }),
  );
  kb.rule(s152_d_2_D({ individual: I, taxpayer: T })).iff(
    stepparent_of({ stepparent: I, child: T }),
  );
  kb.rule(s152_d_2_E({ individual: I, taxpayer: T })).iff(
    and(child_incl_step({ child: I, parent: S }), sibling({ a: S, b: T })),
  );
  kb.rule(s152_d_2_F({ individual: I, taxpayer: T })).iff(
    and(child_of({ child: T, parent: P }), sibling({ a: I, b: P })),
  );
  kb.rule(s152_d_2_G({ individual: I, taxpayer: T })).iff(
    or(
      // Son- or daughter-in-law: married to a child of the taxpayer.
      and(spouses({ a: I, b: C }), child_incl_step({ child: C, parent: T })),
      // Father- or mother-in-law: a parent of the taxpayer's spouse.
      and(spouses({ a: T, b: W }), child_of({ child: W, parent: I })),
      // Brother- or sister-in-law: a sibling of the spouse, or married to a sibling.
      and(spouses({ a: T, b: W }), sibling({ a: I, b: W })),
      and(spouses({ a: I, b: W }), sibling({ a: W, b: T })),
    ),
  );
  kb.rule(spouse_during({ individual: I, taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L, under25After: U }),
      or(
        married_at({ a: I, b: T, day: F }),
        married_at({ a: I, b: T, day: L }),
        and(marriage({ a: I, b: T, start: M }), gte(M, F), lte(M, L)),
      ),
    ),
  );
  kb.rule(s152_d_2_H({ individual: I, taxpayer: T, year: Y })).iff(
    and(
      cohabited_in({ a: I, b: T, year: Y }),
      not(spouse_during({ individual: I, taxpayer: T, year: Y })),
    ),
  );
  kb.rule(s152_d_2({ individual: I, taxpayer: T, year: Y })).iff(
    or(
      s152_d_2_A({ individual: I, taxpayer: T }),
      s152_d_2_B({ individual: I, taxpayer: T }),
      s152_d_2_C({ individual: I, taxpayer: T }),
      s152_d_2_D({ individual: I, taxpayer: T }),
      s152_d_2_E({ individual: I, taxpayer: T }),
      s152_d_2_F({ individual: I, taxpayer: T }),
      s152_d_2_G({ individual: I, taxpayer: T }),
      s152_d_2_H({ individual: I, taxpayer: T, year: Y }),
    ),
  );
  kb.rule(s152_c_2_A({ individual: I, taxpayer: T })).iff(
    descendant_of({ descendant: I, ancestor: T }),
  );
  kb.rule(s152_c_2_B({ individual: I, taxpayer: T })).iff(
    or(
      sibling({ a: I, b: T }),
      and(sibling({ a: S, b: T }), descendant_of({ descendant: I, ancestor: S })),
    ),
  );
  kb.rule(s152_c_2({ individual: I, taxpayer: T })).iff(
    or(s152_c_2_A({ individual: I, taxpayer: T }), s152_c_2_B({ individual: I, taxpayer: T })),
  );
  kb.rule(s152_c_3({ individual: I, taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L, under25After: U }),
      or(
        and(born({ person: I, day: BI }), born({ person: T, day: BT }), gt(BI, BT), gt(BI, U)),
        and(not(has_birth({ person: I })), descendant_of({ descendant: I, ancestor: T })),
      ),
    ),
  );
}
