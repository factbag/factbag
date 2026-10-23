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
import {
  child_of,
  died,
  head_of_household_stated,
  legally_separated,
  Person,
  surviving_spouse_stated,
  year_bounds,
} from "../schema";
import {
  abode_over_half,
  child_incl_step,
  cohabited_in,
  died_during,
  files_jointly,
  maintains_household,
  marriage,
  married_at,
  nra_during,
} from "./helpers";
import { s151_c } from "./s151";
import { dependent_of, qualifying_child, s152_d_2_A_to_G, s152_d_2_H } from "./s152";
import { married_7703 } from "./s7703";

const T = variable("T");
const I = variable("I");
const S = variable("S");
const S1 = variable("S1");
const S2 = variable("S2");
const A = variable("A");
const B = variable("B");
const Y = variable("Y");
const Y1 = variable("Y1");
const Y2 = variable("Y2");
const DY = variable("DY");
const F = variable("F");
const L = variable("L");
const F1 = variable("F1");
const L1 = variable("L1");
const F2 = variable("F2");
const L2 = variable("L2");
const D = variable("D");
const D1 = variable("D1");
const D2 = variable("D2");
const K = variable("K");

const taxpayerYear = { taxpayer: Person, year: BigInt };

// --- (a) Surviving spouse ---

/** (a)(1)(A): the taxpayer's spouse died during either of the two years before the taxable year. */
export const s2_a_1_A = closedPredicate("s2_a_1_A", taxpayerYear);
/**
 * (a)(1)(B): the taxpayer maintains as home a household that is for the year the principal
 * place of abode of a dependent son, stepson, daughter or stepdaughter for whom a §151
 * deduction is allowed.
 */
export const s2_a_1_B = closedPredicate("s2_a_1_B", taxpayerYear);
/** (a)(2)(A): the taxpayer has remarried at any time before the close of the taxable year. */
export const s2_a_2_A = closedPredicate("s2_a_2_A", taxpayerYear);
/**
 * (a)(2)(B): a joint return could have been made for the taxable year, which is to say
 * neither the taxpayer nor the spouse was a nonresident alien at any time during it.
 */
export const s2_a_2_B = closedPredicate("s2_a_2_B", taxpayerYear);
/** A joint return could have been made for the year in which the spouse died. */
const joint_return_possible_at_death = closedPredicate("joint_return_possible_at_death", {
  taxpayer: Person,
  year: BigInt,
});
/** (a): a surviving spouse for the year, derived or stated. */
export const surviving_spouse = closedPredicate("surviving_spouse", taxpayerYear);

// --- (b) Head of household ---

/** (b)(1)(A): maintains as home the principal abode for over half the year of a qualifying child or other dependent with a §151 deduction. */
export const s2_b_1_A = closedPredicate("s2_b_1_A", taxpayerYear);
/** (b)(1)(A) by reason of the individual. */
const s2_b_1_A_by = closedPredicate("s2_b_1_A_by", { ...taxpayerYear, individual: Person });
/** (b)(1)(B): maintains a household that is the principal abode of a parent with a §151 deduction. */
export const s2_b_1_B = closedPredicate("s2_b_1_B", taxpayerYear);
/** (b)(1)(B) by reason of the individual. */
const s2_b_1_B_by = closedPredicate("s2_b_1_B_by", { ...taxpayerYear, individual: Person });
/** The individual is married at the close of the year and has filed a joint return. */
const married_joint_filer = closedPredicate("married_joint_filer", {
  individual: Person,
  year: BigInt,
});
/** (b)(1): not married at the close of the year, not a surviving spouse, and (A) or (B). */
export const s2_b_1 = closedPredicate("s2_b_1", taxpayerYear);
/** (b)(2)(A): the two are legally separated under a decree of divorce or of separate maintenance by the close of the year. */
export const s2_b_2_A = closedPredicate("s2_b_2_A", { a: Person, b: Person, year: BigInt });
/** (b)(2)(B): the taxpayer's spouse is a nonresident alien at some time during the taxable year. */
export const s2_b_2_B = closedPredicate("s2_b_2_B", taxpayerYear);
/** (b)(2)(C): the taxpayer's spouse, other than one described in (B), died during the taxable year. */
export const s2_b_2_C = closedPredicate("s2_b_2_C", taxpayerYear);
/** Married at the close of the year as (b)(1) and (b)(2) determine it. */
const married_for_b = closedPredicate("married_for_b", taxpayerYear);
/** (b)(3)(A): the taxpayer is a nonresident alien at any time during the year. */
export const s2_b_3_A = closedPredicate("s2_b_3_A", taxpayerYear);
/** (b)(3)(B): the individual would not be a dependent of the taxpayer but for §152(d)(2)(H). */
export const s2_b_3_B = closedPredicate("s2_b_3_B", { ...taxpayerYear, individual: Person });
/** (b): a head of household for the year, derived or stated. */
export const head_of_household = closedPredicate("head_of_household", taxpayerYear);
/** (b)(1) holds by reason of an individual not excluded by (b)(3)(B). */
const hoh_by_someone = closedPredicate("hoh_by_someone", taxpayerYear);

export function defineS2(kb: KnowledgeBase): void {
  // (a) Surviving spouse.
  kb.rule(s2_a_1_A({ taxpayer: T, year: Y })).iff(
    and(
      letIn(Y2, sub(Y, 2n), year_bounds({ year: Y2, first: F2, last: L2 })),
      letIn(Y1, sub(Y, 1n), year_bounds({ year: Y1, first: F1, last: L1 })),
      died({ person: S, day: D }),
      gte(D, F2),
      lte(D, L1),
      married_at({ a: T, b: S, day: D }),
    ),
  );
  kb.rule(s2_a_1_B({ taxpayer: T, year: Y })).iff(
    and(
      maintains_household({ person: T, year: Y }),
      child_incl_step({ child: I, parent: T }),
      cohabited_in({ a: T, b: I, year: Y }),
      dependent_of({ dependent: I, taxpayer: T, year: Y }),
      s151_c({ taxpayer: T, dependent: I, year: Y }),
    ),
  );
  kb.rule(s2_a_2_A({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      marriage({ a: T, b: S1, start: D1 }),
      marriage({ a: T, b: S2, start: D2 }),
      gt(D2, D1),
      lte(D2, L),
    ),
  );
  kb.rule(s2_a_2_B({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      marriage({ a: T, b: S, start: D }),
      not(nra_during({ person: T, first: F, last: L })),
      not(nra_during({ person: S, first: F, last: L })),
    ),
  );
  kb.rule(joint_return_possible_at_death({ taxpayer: T, year: Y })).iff(
    and(
      died({ person: S, day: D }),
      married_at({ a: T, b: S, day: D }),
      year_bounds({ year: DY, first: F, last: L }),
      gte(D, F),
      lte(D, L),
      gt(Y, DY),
      not(nra_during({ person: T, first: F, last: L })),
      not(nra_during({ person: S, first: F, last: L })),
    ),
  );
  kb.rule(surviving_spouse({ taxpayer: T, year: Y })).iff(
    or(
      surviving_spouse_stated.undated({ person: T }),
      surviving_spouse_stated.inYear({ person: T, year: Y }),
      and(
        s2_a_1_A({ taxpayer: T, year: Y }),
        s2_a_1_B({ taxpayer: T, year: Y }),
        not(s2_a_2_A({ taxpayer: T, year: Y })),
        joint_return_possible_at_death({ taxpayer: T, year: Y }),
      ),
    ),
  );

  // (b) Head of household.
  kb.rule(s2_b_2_A({ a: A, b: B, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      or(
        and(legally_separated({ a: A, b: B, decree: K, day: D }), lte(D, L)),
        and(legally_separated({ a: B, b: A, decree: K, day: D }), lte(D, L)),
      ),
    ),
  );
  kb.rule(s2_b_2_B({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      marriage({ a: T, b: S, start: D }),
      nra_during({ person: S, first: F, last: L }),
    ),
  );
  kb.rule(s2_b_2_C({ taxpayer: T, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      marriage({ a: T, b: S, start: D }),
      not(nra_during({ person: S, first: F, last: L })),
      died_during({ person: S, first: F, last: L }),
    ),
  );
  kb.rule(married_for_b({ taxpayer: T, year: Y })).iff(
    or(
      and(married_7703({ taxpayer: T, year: Y }), not(s2_b_2_B({ taxpayer: T, year: Y }))),
      s2_b_2_C({ taxpayer: T, year: Y }),
    ),
  );
  kb.rule(married_joint_filer({ individual: I, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      married_at({ a: I, b: S, day: L }),
      files_jointly({ person: I, year: Y }),
    ),
  );
  kb.rule(s2_b_1_A_by({ taxpayer: T, individual: I, year: Y })).iff(
    and(
      maintains_household({ person: T, year: Y }),
      abode_over_half({ a: T, b: I, year: Y }),
      or(
        // (i) A qualifying child, unless married at the close of the year and not a
        // dependent because of a joint return (§152(b)(2)).
        and(
          qualifying_child({ individual: I, taxpayer: T, year: Y }),
          not(married_joint_filer({ individual: I, year: Y })),
        ),
        // (ii) Any other dependent with a §151 deduction.
        and(
          dependent_of({ dependent: I, taxpayer: T, year: Y }),
          s151_c({ taxpayer: T, dependent: I, year: Y }),
        ),
      ),
    ),
  );
  kb.rule(s2_b_1_A({ taxpayer: T, year: Y })).iff(
    s2_b_1_A_by({ taxpayer: T, individual: I, year: Y }),
  );
  kb.rule(s2_b_1_B_by({ taxpayer: T, individual: I, year: Y })).iff(
    and(
      maintains_household({ person: T, year: Y }),
      child_of({ child: T, parent: I }),
      cohabited_in({ a: T, b: I, year: Y }),
      s151_c({ taxpayer: T, dependent: I, year: Y }),
    ),
  );
  kb.rule(s2_b_1_B({ taxpayer: T, year: Y })).iff(
    s2_b_1_B_by({ taxpayer: T, individual: I, year: Y }),
  );
  kb.rule(s2_b_1({ taxpayer: T, year: Y })).iff(
    and(
      not(married_for_b({ taxpayer: T, year: Y })),
      not(surviving_spouse({ taxpayer: T, year: Y })),
      or(s2_b_1_A({ taxpayer: T, year: Y }), s2_b_1_B({ taxpayer: T, year: Y })),
    ),
  );
  kb.rule(s2_b_3_A({ taxpayer: T, year: Y })).iff(
    and(year_bounds({ year: Y, first: F, last: L }), nra_during({ person: T, first: F, last: L })),
  );
  kb.rule(s2_b_3_B({ taxpayer: T, individual: I, year: Y })).iff(
    and(
      dependent_of({ dependent: I, taxpayer: T, year: Y }),
      s152_d_2_H({ individual: I, taxpayer: T, year: Y }),
      not(s152_d_2_A_to_G({ individual: I, taxpayer: T })),
      not(qualifying_child({ individual: I, taxpayer: T, year: Y })),
    ),
  );
  kb.rule(hoh_by_someone({ taxpayer: T, year: Y })).iff(
    and(
      or(
        s2_b_1_A_by({ taxpayer: T, individual: I, year: Y }),
        s2_b_1_B_by({ taxpayer: T, individual: I, year: Y }),
      ),
      not(s2_b_3_B({ taxpayer: T, individual: I, year: Y })),
    ),
  );
  kb.rule(head_of_household({ taxpayer: T, year: Y })).iff(
    or(
      head_of_household_stated.undated({ person: T }),
      head_of_household_stated.inYear({ person: T, year: Y }),
      and(
        s2_b_1({ taxpayer: T, year: Y }),
        hoh_by_someone({ taxpayer: T, year: Y }),
        not(s2_b_3_A({ taxpayer: T, year: Y })),
      ),
    ),
  );
}
