/**
 * §152. Dependent defined: the qualifying child of subsection (c), the qualifying relative
 * of subsection (d), the exceptions of subsection (b), and the dependent they define.
 */
import {
  and,
  closedPredicate,
  gt,
  gte,
  lte,
  not,
  or,
  variable,
  yearsBetween,
} from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import {
  born,
  child_of,
  dependent_152,
  Person,
  qualifying_child_152c,
  satisfies_152c2,
  satisfies_152c3,
  year_bounds,
} from "../schema";
import {
  abode_over_half,
  child_incl_step,
  cohabited_in,
  descendant_of,
  files_jointly,
  has_birth,
  has_income,
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
const BI = variable("BI");
const BT = variable("BT");
const C = variable("C");
const P = variable("P");
const W = variable("W");
const M = variable("M");
const X = variable("X");
const O = variable("O");

const relation = { individual: Person, taxpayer: Person };
const relationInYear = { ...relation, year: BigInt };

// --- (b) Exceptions ---

/** (b)(1): the taxpayer is a dependent of some taxpayer for the year, so has no dependents. */
export const s152_b_1 = closedPredicate("s152_b_1", { taxpayer: Person, year: BigInt });
/** (b)(2): the individual has made a joint return with their spouse for the year. */
export const s152_b_2 = closedPredicate("s152_b_2", { individual: Person, year: BigInt });

// --- (c) Qualifying child ---

/** (c)(1): the individual is a qualifying child of the taxpayer for the year. */
export const s152_c_1 = closedPredicate("s152_c_1", relationInYear);
/** (c)(1)(B): the same principal place of abode as the taxpayer for more than half the year. */
export const s152_c_1_B = closedPredicate("s152_c_1_B", relationInYear);
/** (c)(1)(E): the individual has not filed a joint return with their spouse for the year. */
export const s152_c_1_E = closedPredicate("s152_c_1_E", { individual: Person, year: BigInt });
/** (c)(2)(A): the individual is a child of the taxpayer or a descendant of such a child. */
export const s152_c_2_A = closedPredicate("s152_c_2_A", relation);
/** (c)(2)(B): the individual is a sibling of the taxpayer or a descendant of such a sibling. */
export const s152_c_2_B = closedPredicate("s152_c_2_B", relation);
/** (c)(2): the individual bears one of the relationships to the taxpayer. */
export const s152_c_2 = closedPredicate("s152_c_2", relation);
/**
 * (c)(3): the individual is younger than the taxpayer and under 25 at the close of the
 * year. The individual's date of birth must be stated, or they cannot be under 25. The
 * taxpayer's is compared when stated; when it is not, a descendant of the taxpayer is taken
 * to be the younger, as the reference formalization does, and anyone else is not.
 */
export const s152_c_3 = closedPredicate("s152_c_3", relationInYear);
/** A qualifying child of the taxpayer: stated as one, or meeting (c)(1). */
export const qualifying_child = closedPredicate("qualifying_child", relationInYear);
/** The individual is a qualifying child of some taxpayer for the year. */
const qualifying_child_of_any = closedPredicate("qualifying_child_of_any", {
  individual: Person,
  year: BigInt,
});

// --- (d) Qualifying relative ---

/** (d)(1): the individual is a qualifying relative of the taxpayer for the year. */
export const s152_d_1 = closedPredicate("s152_d_1", relationInYear);
/** (d)(1)(B): the individual has no income for the year: none stated, or none as stated. */
export const s152_d_1_B = closedPredicate("s152_d_1_B", { individual: Person, year: BigInt });
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
export const s152_d_2_H = closedPredicate("s152_d_2_H", relationInYear);
/** (d)(2): any of the relationships (A) to (H), for the year. */
export const s152_d_2 = closedPredicate("s152_d_2", relationInYear);
/** Any of the family relationships (A) to (G), which need no year. */
export const s152_d_2_A_to_G = closedPredicate("s152_d_2_A_to_G", relation);
/** The individual was the taxpayer's spouse at some time during the year. */
const spouse_during = closedPredicate("spouse_during", relationInYear);

// --- (a) Dependent ---

/**
 * The individual is a dependent of the taxpayer for the year before the exceptions of
 * subsection (b): stated as a dependent under this section, a qualifying child under (c),
 * or a qualifying relative under (d). A stated §151(c) deduction is not among these: as in
 * the reference formalization it satisfies §151(c) directly without defining a dependency.
 */
const dependent_base = closedPredicate("dependent_base", {
  dependent: Person,
  taxpayer: Person,
  year: BigInt,
});
/**
 * A dependent of the taxpayer under (a) and (b)(2), without the (b)(1) test. This is the
 * dependency (b)(1) asks about: the reference formalization, when it tests whether the
 * taxpayer is someone's dependent, does not test in turn whether that someone is, so the
 * recursion stops one level down. It also stops here.
 */
const dependent_before_b1 = closedPredicate("dependent_before_b1", {
  dependent: Person,
  taxpayer: Person,
  year: BigInt,
});
/**
 * The taxpayer is someone's dependent before (b)(1) for the year, so (b)(1) leaves them
 * no dependents. When two people each qualify as the other's dependent, each defeats the
 * other and neither is a dependent; the statute gives no order between them, and the
 * reference formalization answers the same way.
 */
const s152_b_1_inner = closedPredicate("s152_b_1_inner", { taxpayer: Person, year: BigInt });
/** The individual is a dependent of the taxpayer for the year, with the (b) exceptions. */
export const dependent_of = closedPredicate("dependent_of", {
  dependent: Person,
  taxpayer: Person,
  year: BigInt,
});

export function defineS152(kb: KnowledgeBase): void {
  // (c)(2) relationship and (c)(3) age.
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
      year_bounds({ year: Y, first: F, last: L }),
      born({ person: I, day: BI }),
      gt(25, yearsBetween(L, BI)),
      or(
        and(born({ person: T, day: BT }), gt(BI, BT)),
        and(not(has_birth({ person: T })), descendant_of({ descendant: I, ancestor: T })),
      ),
    ),
  );
  // (c)(1) qualifying child. A stated "satisfies (c)(2)" or "(c)(3)" counts for that test.
  kb.rule(s152_c_1_B({ individual: I, taxpayer: T, year: Y })).iff(
    abode_over_half({ a: I, b: T, year: Y }),
  );
  kb.rule(s152_c_1_E({ individual: I, year: Y })).iff(not(files_jointly({ person: I, year: Y })));
  kb.rule(s152_c_1({ individual: I, taxpayer: T, year: Y })).iff(
    and(
      or(
        s152_c_2({ individual: I, taxpayer: T }),
        satisfies_152c2.undated({ child: I, taxpayer: T }),
        satisfies_152c2.inYear({ child: I, taxpayer: T, year: Y }),
      ),
      s152_c_1_B({ individual: I, taxpayer: T, year: Y }),
      or(
        s152_c_3({ individual: I, taxpayer: T, year: Y }),
        satisfies_152c3.undated({ child: I, taxpayer: T }),
        satisfies_152c3.inYear({ child: I, taxpayer: T, year: Y }),
      ),
      s152_c_1_E({ individual: I, year: Y }),
    ),
  );
  kb.rule(qualifying_child({ individual: I, taxpayer: T, year: Y })).iff(
    or(
      qualifying_child_152c.undated({ child: I, taxpayer: T }),
      qualifying_child_152c.inYear({ child: I, taxpayer: T, year: Y }),
      s152_c_1({ individual: I, taxpayer: T, year: Y }),
    ),
  );
  kb.rule(qualifying_child_of_any({ individual: I, year: Y })).iff(
    qualifying_child({ individual: I, taxpayer: X, year: Y }),
  );

  // (d)(2) relationships.
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
      year_bounds({ year: Y, first: F, last: L }),
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
  kb.rule(s152_d_2_A_to_G({ individual: I, taxpayer: T })).iff(
    or(
      s152_d_2_A({ individual: I, taxpayer: T }),
      s152_d_2_B({ individual: I, taxpayer: T }),
      s152_d_2_C({ individual: I, taxpayer: T }),
      s152_d_2_D({ individual: I, taxpayer: T }),
      s152_d_2_E({ individual: I, taxpayer: T }),
      s152_d_2_F({ individual: I, taxpayer: T }),
      s152_d_2_G({ individual: I, taxpayer: T }),
    ),
  );
  kb.rule(s152_d_2({ individual: I, taxpayer: T, year: Y })).iff(
    or(
      s152_d_2_A_to_G({ individual: I, taxpayer: T }),
      s152_d_2_H({ individual: I, taxpayer: T, year: Y }),
    ),
  );
  // (d)(1) qualifying relative. Subparagraph (C), support, is not in SARA's statute.
  kb.rule(s152_d_1_B({ individual: I, year: Y })).iff(not(has_income({ person: I, year: Y })));
  // The relationship comes first: it binds the individual when the taxpayer's relatives
  // are being enumerated, which the income and qualifying-child tests then check.
  kb.rule(s152_d_1({ individual: I, taxpayer: T, year: Y })).iff(
    and(
      s152_d_2({ individual: I, taxpayer: T, year: Y }),
      s152_d_1_B({ individual: I, year: Y }),
      not(qualifying_child_of_any({ individual: I, year: Y })),
    ),
  );

  // (a) dependent, with the (b) exceptions.
  kb.rule(dependent_base({ dependent: I, taxpayer: T, year: Y })).iff(
    or(
      dependent_152.undated({ dependent: I, taxpayer: T }),
      dependent_152.inYear({ dependent: I, taxpayer: T, year: Y }),
      qualifying_child({ individual: I, taxpayer: T, year: Y }),
      s152_d_1({ individual: I, taxpayer: T, year: Y }),
    ),
  );
  kb.rule(s152_b_2({ individual: I, year: Y })).iff(files_jointly({ person: I, year: Y }));
  kb.rule(dependent_before_b1({ dependent: I, taxpayer: T, year: Y })).iff(
    and(
      dependent_base({ dependent: I, taxpayer: T, year: Y }),
      not(s152_b_2({ individual: I, year: Y })),
    ),
  );
  kb.rule(s152_b_1_inner({ taxpayer: T, year: Y })).iff(
    dependent_before_b1({ dependent: T, taxpayer: O, year: Y }),
  );
  kb.rule(dependent_of({ dependent: I, taxpayer: T, year: Y })).iff(
    and(
      dependent_before_b1({ dependent: I, taxpayer: T, year: Y }),
      not(s152_b_1_inner({ taxpayer: T, year: Y })),
    ),
  );
  kb.rule(s152_b_1({ taxpayer: T, year: Y })).iff(
    dependent_of({ dependent: T, taxpayer: X, year: Y }),
  );
}
