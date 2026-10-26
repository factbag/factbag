/**
 * §63. Taxable income defined: the standard deduction of subsection (c) with its aged and
 * blind additions of (f), itemized deductions of (d), and taxable income under (a) and (b).
 */
import {
  add,
  and,
  closedPredicate,
  count,
  enumeration,
  eq,
  gt,
  gte,
  letIn,
  lte,
  max,
  min,
  mul,
  not,
  or,
  sub,
  sum,
  variable,
  yearsBetween,
} from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import {
  additional_amount_63f,
  aged,
  born,
  business_entity,
  own_additional_amount_63f,
  Person,
  taxable_income,
  year_bounds,
} from "../schema";
import {
  blind_at_close,
  files_jointly,
  gross_income_of,
  has_stated,
  itemizes,
  nra_during,
  spouse_at_close,
  stated,
} from "./helpers";
import { dependent_exemptions, exemption_amount, s151_a, s151_b, s151_c, s151_d_2 } from "./s151";
import { head_of_household, surviving_spouse } from "./s2";
import { itemized_after_68 } from "./s68";
import { agi, joint_spouse, married_7703, married_separate } from "./s7703";

const T = variable("T");
const S = variable("S");
const Y = variable("Y");
const A = variable("A");
const B = variable("B");
const G = variable("G");
const I = variable("I");
const X = variable("X");
const M = variable("M");
const N = variable("N");
const U = variable("U");
const F = variable("F");
const L = variable("L");
const D = variable("D");
const K = variable("K");
const SD = variable("SD");
const X2 = variable("X2");
const E = variable("E");

const taxpayerYear = { taxpayer: Person, year: Number };
const valued = { ...taxpayerYear, amount: Number };
const withSpouse = { taxpayer: Person, spouse: Person, year: Number };

// --- (c)(2) Basic standard deduction ---

/** (c)(2)(A)(i): a joint return: the taxpayer is married and files one for the year. */
export const s63_c_2_A_i = closedPredicate("s63_c_2_A_i", taxpayerYear);
/** (c)(2)(A)(ii): a surviving spouse as §2(a) defines one. */
export const s63_c_2_A_ii = closedPredicate("s63_c_2_A_ii", taxpayerYear);
/** (c)(2)(A): a joint return or a surviving spouse: 200 percent of the (C) amount. */
export const s63_c_2_A = closedPredicate("s63_c_2_A", taxpayerYear);
/** (c)(2)(B): a head of household: $4,400, or $18,000 for 2018 through 2025. */
export const s63_c_2_B = closedPredicate("s63_c_2_B", taxpayerYear);
/** (c)(2)(C): any other case: $3,000, or $12,000 for 2018 through 2025. */
export const s63_c_2_C = closedPredicate("s63_c_2_C", taxpayerYear);
/** (c)(7): the substitutions for taxable years 2018 through 2025 are in effect. */
const s63_c_7 = closedPredicate("s63_c_7", taxpayerYear);
export const s63_c_2_A_amount = closedPredicate("s63_c_2_A_amount", valued);
export const s63_c_2_B_amount = closedPredicate("s63_c_2_B_amount", valued);
export const s63_c_2_C_amount = closedPredicate("s63_c_2_C_amount", valued);
/** (c)(7)(i): $18,000 for a head of household in 2018 through 2025. */
export const s63_c_7_i_amount = closedPredicate("s63_c_7_i_amount", valued);
/** (c)(7)(ii): $12,000 in any other case in 2018 through 2025. */
export const s63_c_7_ii_amount = closedPredicate("s63_c_7_ii_amount", valued);
/** (c)(2): the basic standard deduction before the limitation of (c)(5), stated or derived. */
export const s63_c_2 = closedPredicate("s63_c_2", valued);

// --- (c)(5), (c)(6) Limitations ---

/** (c)(5): a §151 deduction for the individual is allowable to another taxpayer. */
export const s63_c_5 = closedPredicate("s63_c_5", taxpayerYear);
/** (c)(5) with its cap: the greater of $500 and $250 plus the individual's earned income. */
export const s63_c_5_amount = closedPredicate("s63_c_5_amount", valued);
/** (c)(1)(A): the basic standard deduction, capped under (c)(5) when that applies. */
const s63_c_1_A = closedPredicate("s63_c_1_A", valued);
/** (c)(6)(A): married filing separately where either spouse itemizes. */
export const s63_c_6_A = closedPredicate("s63_c_6_A", taxpayerYear);
/** (c)(6)(B): a nonresident alien. */
export const s63_c_6_B = closedPredicate("s63_c_6_B", taxpayerYear);
/** (c)(6)(D): an estate or trust, common trust fund, or partnership, at some time in the year. */
export const s63_c_6_D = closedPredicate("s63_c_6_D", taxpayerYear);
/** The entity's existence ended before the day. */
const entity_ended_before = closedPredicate("entity_ended_before", { person: Person, day: Date });
/** The text dates the entity's start. */
const entity_has_since = closedPredicate("entity_has_since", { person: Person });
/** (c)(6): the standard deduction is zero. */
export const s63_c_6 = closedPredicate("s63_c_6", taxpayerYear);

// --- (f) Aged or blind additional amounts ---

/** (f)(1)(A): the taxpayer has attained age 65 before the close of the year. */
/** The person has attained age 65 by the close of the year, by birth date or stated age. */
const attained_65 = closedPredicate("attained_65", { person: Person, year: Number });
export const s63_f_1_A = closedPredicate("s63_f_1_A", taxpayerYear);
/** (f)(1)(B): the spouse has attained 65 and a §151(b) exemption is allowable for them. */
export const s63_f_1_B = closedPredicate("s63_f_1_B", withSpouse);
/** (f)(2)(A): the taxpayer is blind at the close of the year. */
export const s63_f_2_A = closedPredicate("s63_f_2_A", taxpayerYear);
/** (f)(2)(B): the spouse is blind at the close of the year and a §151(b) exemption is allowable. */
export const s63_f_2_B = closedPredicate("s63_f_2_B", withSpouse);
/** (f)(3): not married and not a surviving spouse, so $750 replaces $600. */
export const s63_f_3 = closedPredicate("s63_f_3", taxpayerYear);
const ADDITIONS = enumeration("aged_self", "aged_spouse", "blind_self", "blind_spouse");
/** Each additional amount the taxpayer is entitled to under (f), by kind. */
const s63_f_item = closedPredicate("s63_f_item", { ...taxpayerYear, item: ADDITIONS });
/** The additional amount in effect: $600, or $750 under (f)(3). */
const s63_f_unit = closedPredicate("s63_f_unit", valued);
/** A stated additional amount under (f) for the taxpayer and year, by beneficiary. */
const additional_63f = closedPredicate("additional_63f", {
  ...taxpayerYear,
  beneficiary: Person,
  amount: Number,
});
const has_additional_63f = closedPredicate("has_additional_63f", taxpayerYear);
/** (f): the sum of the additional amounts, stated or derived. */
export const s63_f = closedPredicate("s63_f", valued);
/** (f)(3) with the total it produces, when it applies. */
export const s63_f_3_amount = closedPredicate("s63_f_3_amount", valued);

// --- (c)(1), (c)(3), (c): the standard deduction ---

/** (c)(3): the additional standard deduction, the sum of the (f) amounts. */
export const s63_c_3 = closedPredicate("s63_c_3", valued);
/** (c)(1): the standard deduction: zero under (c)(6), else basic plus additional. */
export const s63_c_1 = closedPredicate("s63_c_1", valued);
/** (c): the standard deduction, stated or by (c)(1). */
export const s63_c = closedPredicate("s63_c", valued);

// --- (d), (a), (b): itemized deductions and taxable income ---

/** (d): the taxpayer has itemized deductions for the year. */
export const s63_d = closedPredicate("s63_d", taxpayerYear);
/** (d)(2): the taxpayer's stated deduction is one for personal exemptions under §151. */
export const s63_d_2 = closedPredicate("s63_d_2", taxpayerYear);
/** The §151 deductions on the return: the taxpayer's, plus the spouse's on a joint return. */
export const s151_return = closedPredicate("s151_return", valued);
const has_joint_spouse_63 = closedPredicate("has_joint_spouse_63", taxpayerYear);
/** A dependent of the spouse who is not also the taxpayer's. */
const spouse_only_dependent = closedPredicate("spouse_only_dependent", {
  taxpayer: Person,
  spouse: Person,
  dependent: Person,
  year: Number,
});
/** Either spouse's §151 total is stated outright. */
const stated_151_either = closedPredicate("stated_151_either", {
  taxpayer: Person,
  spouse: Person,
  year: Number,
});
/** (a): gross income less itemized deductions (after §68) and the §151 exemptions. */
export const s63_a = closedPredicate("s63_a", valued);
/** (b): for one who does not itemize, gross income less the standard deduction and §151. */
export const s63_b = closedPredicate("s63_b", valued);
/** Taxable income: stated, or (b) for one who does not itemize, else (a). */
export const taxable_income_of = closedPredicate("taxable_income_of", valued);
const has_taxable_income = closedPredicate("has_taxable_income", taxpayerYear);

export function defineS63(kb: KnowledgeBase): void {
  // (c)(2) basic standard deduction.
  kb.rule(s63_c_2_A_i({ taxpayer: T, year: Y })).iff(
    and(married_7703({ taxpayer: T, year: Y }), files_jointly({ person: T, year: Y })),
  );
  kb.rule(s63_c_2_A_ii({ taxpayer: T, year: Y })).iff(surviving_spouse({ taxpayer: T, year: Y }));
  kb.rule(s63_c_2_A({ taxpayer: T, year: Y })).iff(
    or(s63_c_2_A_i({ taxpayer: T, year: Y }), s63_c_2_A_ii({ taxpayer: T, year: Y })),
  );
  kb.rule(s63_c_2_B({ taxpayer: T, year: Y })).iff(
    and(head_of_household({ taxpayer: T, year: Y }), not(s63_c_2_A({ taxpayer: T, year: Y }))),
  );
  kb.rule(s63_c_2_C({ taxpayer: T, year: Y })).iff(
    and(not(s63_c_2_A({ taxpayer: T, year: Y })), not(s63_c_2_B({ taxpayer: T, year: Y }))),
  );
  kb.rule(s63_c_7({ taxpayer: T, year: Y })).iff(and(gte(Y, 2018), lte(Y, 2025)));
  kb.rule(s63_c_7_i_amount({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s63_c_2_B({ taxpayer: T, year: Y }),
      s63_c_7({ taxpayer: T, year: Y }),
      letIn(A, 18_000, gte(A, 0)),
    ),
  );
  kb.rule(s63_c_7_ii_amount({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s63_c_2_C({ taxpayer: T, year: Y }),
      s63_c_7({ taxpayer: T, year: Y }),
      letIn(A, 12_000, gte(A, 0)),
    ),
  );
  kb.rule(s63_c_2_A_amount({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s63_c_2_A({ taxpayer: T, year: Y }),
      or(
        and(s63_c_7({ taxpayer: T, year: Y }), letIn(A, 24_000, gte(A, 0))),
        and(not(s63_c_7({ taxpayer: T, year: Y })), letIn(A, 6000, gte(A, 0))),
      ),
    ),
  );
  kb.rule(s63_c_2_B_amount({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      s63_c_7_i_amount({ taxpayer: T, year: Y, amount: A }),
      and(
        s63_c_2_B({ taxpayer: T, year: Y }),
        not(s63_c_7({ taxpayer: T, year: Y })),
        letIn(A, 4400, gte(A, 0)),
      ),
    ),
  );
  kb.rule(s63_c_2_C_amount({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      s63_c_7_ii_amount({ taxpayer: T, year: Y, amount: A }),
      and(
        s63_c_2_C({ taxpayer: T, year: Y }),
        not(s63_c_7({ taxpayer: T, year: Y })),
        letIn(A, 3000, gte(A, 0)),
      ),
    ),
  );
  kb.rule(s63_c_2({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      stated({ person: T, year: Y, kind: "basic_standard_deduction_63c2", amount: A }),
      and(
        not(has_stated({ person: T, year: Y, kind: "basic_standard_deduction_63c2" })),
        or(
          s63_c_2_A_amount({ taxpayer: T, year: Y, amount: A }),
          s63_c_2_B_amount({ taxpayer: T, year: Y, amount: A }),
          s63_c_2_C_amount({ taxpayer: T, year: Y, amount: A }),
        ),
      ),
    ),
  );

  // (c)(5) and (c)(6) limitations.
  kb.rule(s63_c_5({ taxpayer: T, year: Y })).iff(s151_d_2({ taxpayer: T, year: Y }));
  kb.rule(s63_c_5_amount({ taxpayer: T, year: Y, amount: M })).iff(
    and(
      s63_c_5({ taxpayer: T, year: Y }),
      gross_income_of({ person: T, year: Y, amount: G }),
      letIn(M, max(500, add(250, G)), gte(M, 0)),
    ),
  );
  kb.rule(s63_c_1_A({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s63_c_2({ taxpayer: T, year: Y, amount: B }),
      or(
        and(s63_c_5_amount({ taxpayer: T, year: Y, amount: M }), letIn(A, min(B, M), gte(A, 0))),
        and(not(s63_c_5({ taxpayer: T, year: Y })), letIn(A, B, gte(A, 0))),
      ),
    ),
  );
  kb.rule(s63_c_6_A({ taxpayer: T, year: Y })).iff(
    and(
      married_separate({ taxpayer: T, year: Y }),
      or(
        itemizes({ person: T, year: Y }),
        and(spouse_at_close({ taxpayer: T, spouse: S, year: Y }), itemizes({ person: S, year: Y })),
      ),
    ),
  );
  kb.rule(s63_c_6_B({ taxpayer: T, year: Y })).iff(
    and(year_bounds({ year: Y, first: F, last: L }), nra_during({ person: T, first: F, last: L })),
  );
  // (c)(6)(D): the entity existed at some time in the year, as the dated facts place it.
  kb.rule(entity_ended_before({ person: T, day: D })).iff(
    and(business_entity.until({ person: T, kind: K, day: X }), gt(D, X)),
  );
  kb.rule(entity_has_since({ person: T })).iff(
    business_entity.since({ person: T, kind: K, day: D }),
  );
  kb.rule(s63_c_6_D({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      or(
        business_entity.undated({ person: T, kind: K }),
        business_entity.inYear({ person: T, kind: K, year: Y }),
        and(
          business_entity.since({ person: T, kind: K, day: D }),
          lte(D, L),
          not(entity_ended_before({ person: T, day: F })),
        ),
        and(
          business_entity.until({ person: T, kind: K, day: D }),
          gte(D, F),
          not(entity_has_since({ person: T })),
        ),
      ),
    ),
  );
  kb.rule(s63_c_6({ taxpayer: T, year: Y })).iff(
    or(
      s63_c_6_A({ taxpayer: T, year: Y }),
      s63_c_6_B({ taxpayer: T, year: Y }),
      s63_c_6_D({ taxpayer: T, year: Y }),
    ),
  );

  // (f) aged or blind.
  kb.rule(attained_65({ person: T, year: Y })).iff(
    or(
      and(
        year_bounds({ year: Y, first: F, last: L }),
        born({ person: T, day: D }),
        gte(yearsBetween(L, D), 65),
      ),
      and(aged({ person: T, years: N, year: Y }), gte(N, 65)),
    ),
  );
  kb.rule(s63_f_1_A({ taxpayer: T, year: Y })).iff(attained_65({ person: T, year: Y }));
  kb.rule(s63_f_1_B({ taxpayer: T, spouse: S, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      spouse_at_close({ taxpayer: T, spouse: S, year: Y }),
      attained_65({ person: S, year: Y }),
      s151_b({ taxpayer: T, spouse: S, year: Y }),
    ),
  );
  kb.rule(s63_f_2_A({ taxpayer: T, year: Y })).iff(blind_at_close({ person: T, year: Y }));
  kb.rule(s63_f_2_B({ taxpayer: T, spouse: S, year: Y })).iff(
    and(
      spouse_at_close({ taxpayer: T, spouse: S, year: Y }),
      blind_at_close({ person: S, year: Y }),
      s151_b({ taxpayer: T, spouse: S, year: Y }),
    ),
  );
  kb.rule(s63_f_3({ taxpayer: T, year: Y })).iff(
    and(
      not(married_7703({ taxpayer: T, year: Y })),
      not(surviving_spouse({ taxpayer: T, year: Y })),
    ),
  );
  kb.rule(s63_f_item({ taxpayer: T, year: Y, item: K })).iff(
    or(
      and(s63_f_1_A({ taxpayer: T, year: Y }), letIn(K, "aged_self", eq(K, "aged_self"))),
      and(
        s63_f_1_B({ taxpayer: T, spouse: S, year: Y }),
        letIn(K, "aged_spouse", eq(K, "aged_spouse")),
      ),
      and(s63_f_2_A({ taxpayer: T, year: Y }), letIn(K, "blind_self", eq(K, "blind_self"))),
      and(
        s63_f_2_B({ taxpayer: T, spouse: S, year: Y }),
        letIn(K, "blind_spouse", eq(K, "blind_spouse")),
      ),
    ),
  );
  kb.rule(s63_f_unit({ taxpayer: T, year: Y, amount: U })).iff(
    or(
      and(s63_f_3({ taxpayer: T, year: Y }), letIn(U, 750, gte(U, 0))),
      and(not(s63_f_3({ taxpayer: T, year: Y })), letIn(U, 600, gte(U, 0))),
    ),
  );
  kb.rule(additional_63f({ taxpayer: T, year: Y, beneficiary: S, amount: X })).iff(
    or(
      additional_amount_63f.undated({ taxpayer: T, beneficiary: S, amount: X }),
      additional_amount_63f.inYear({ taxpayer: T, beneficiary: S, amount: X, year: Y }),
      and(own_additional_amount_63f.undated({ taxpayer: T, amount: X }), letIn(S, T, eq(S, T))),
      and(
        own_additional_amount_63f.inYear({ taxpayer: T, amount: X, year: Y }),
        letIn(S, T, eq(S, T)),
      ),
    ),
  );
  kb.rule(has_additional_63f({ taxpayer: T, year: Y })).iff(
    additional_63f({ taxpayer: T, year: Y, beneficiary: S, amount: X }),
  );
  kb.rule(s63_f({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      and(
        has_additional_63f({ taxpayer: T, year: Y }),
        letIn(
          A,
          sum(X).where(additional_63f({ taxpayer: T, year: Y, beneficiary: S, amount: X })),
          gte(A, 0),
        ),
      ),
      and(
        not(has_additional_63f({ taxpayer: T, year: Y })),
        s63_f_unit({ taxpayer: T, year: Y, amount: U }),
        letIn(
          N,
          count(K).where(s63_f_item({ taxpayer: T, year: Y, item: K })),
          letIn(A, mul(U, N), gte(A, 0)),
        ),
      ),
    ),
  );
  kb.rule(s63_f_3_amount({ taxpayer: T, year: Y, amount: A })).iff(
    and(s63_f_3({ taxpayer: T, year: Y }), s63_f({ taxpayer: T, year: Y, amount: A })),
  );

  // (c)(3), (c)(1), (c).
  kb.rule(s63_c_3({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      stated({ person: T, year: Y, kind: "additional_standard_deduction_63c3", amount: A }),
      and(
        not(has_stated({ person: T, year: Y, kind: "additional_standard_deduction_63c3" })),
        s63_f({ taxpayer: T, year: Y, amount: A }),
      ),
    ),
  );
  kb.rule(s63_c_1({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      and(s63_c_6({ taxpayer: T, year: Y }), letIn(A, 0, gte(A, 0))),
      and(
        not(s63_c_6({ taxpayer: T, year: Y })),
        s63_c_1_A({ taxpayer: T, year: Y, amount: B }),
        s63_c_3({ taxpayer: T, year: Y, amount: X }),
        letIn(A, add(B, X), gte(A, 0)),
      ),
    ),
  );
  kb.rule(s63_c({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      stated({ person: T, year: Y, kind: "standard_deduction_63c", amount: A }),
      and(
        not(has_stated({ person: T, year: Y, kind: "standard_deduction_63c" })),
        s63_c_1({ taxpayer: T, year: Y, amount: A }),
      ),
    ),
  );

  // (d), (a), (b).
  kb.rule(s63_d({ taxpayer: T, year: Y })).iff(itemizes({ person: T, year: Y }));
  kb.rule(s63_d_2({ taxpayer: T, year: Y })).iff(
    or(
      has_stated({ person: T, year: Y, kind: "exemption_151" }),
      has_stated({ person: T, year: Y, kind: "exemption_151c" }),
    ),
  );
  kb.rule(has_joint_spouse_63({ taxpayer: T, year: Y })).iff(
    joint_spouse({ taxpayer: T, spouse: S, year: Y }),
  );
  kb.rule(spouse_only_dependent({ taxpayer: T, spouse: S, dependent: D, year: Y })).iff(
    and(
      s151_c({ taxpayer: S, dependent: D, year: Y }),
      not(s151_c({ taxpayer: T, dependent: D, year: Y })),
    ),
  );
  kb.rule(stated_151_either({ taxpayer: T, spouse: S, year: Y })).iff(
    or(
      has_stated({ person: T, year: Y, kind: "exemption_151" }),
      has_stated({ person: S, year: Y, kind: "exemption_151" }),
    ),
  );
  // On a joint return the exemptions are each spouse's own and one for each dependent of
  // either, a dependent of both counted once. Stated §151 totals are summed as stated.
  kb.rule(s151_return({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      and(
        joint_spouse({ taxpayer: T, spouse: S, year: Y }),
        stated_151_either({ taxpayer: T, spouse: S, year: Y }),
        s151_a({ taxpayer: T, year: Y, amount: X }),
        s151_a({ taxpayer: S, year: Y, amount: X2 }),
        letIn(A, add(X, X2), gte(A, 0)),
      ),
      and(
        joint_spouse({ taxpayer: T, spouse: S, year: Y }),
        not(stated_151_either({ taxpayer: T, spouse: S, year: Y })),
        exemption_amount({ taxpayer: T, year: Y, amount: E }),
        dependent_exemptions({ taxpayer: T, year: Y, amount: X }),
        letIn(
          N,
          count(D).where(spouse_only_dependent({ taxpayer: T, spouse: S, dependent: D, year: Y })),
          letIn(A, add(mul(E, add(2, N)), X), gte(A, 0)),
        ),
      ),
      and(
        not(has_joint_spouse_63({ taxpayer: T, year: Y })),
        s151_a({ taxpayer: T, year: Y, amount: A }),
      ),
    ),
  );
  kb.rule(s63_a({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      agi({ taxpayer: T, year: Y, amount: G }),
      itemized_after_68({ taxpayer: T, year: Y, amount: I }),
      s151_return({ taxpayer: T, year: Y, amount: X }),
      letIn(A, max(sub(G, add(I, X)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s63_b({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      not(itemizes({ person: T, year: Y })),
      agi({ taxpayer: T, year: Y, amount: G }),
      s63_c({ taxpayer: T, year: Y, amount: SD }),
      s151_return({ taxpayer: T, year: Y, amount: X }),
      letIn(A, max(sub(G, add(SD, X)), 0), gte(A, 0)),
    ),
  );
  kb.rule(has_taxable_income({ taxpayer: T, year: Y })).iff(
    taxable_income({ person: T, year: Y, amount: A }),
  );
  kb.rule(taxable_income_of({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      taxable_income({ person: T, year: Y, amount: A }),
      and(
        not(has_taxable_income({ taxpayer: T, year: Y })),
        or(
          s63_b({ taxpayer: T, year: Y, amount: A }),
          and(itemizes({ person: T, year: Y }), s63_a({ taxpayer: T, year: Y, amount: A })),
        ),
      ),
    ),
  );
}
