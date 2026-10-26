/** §7703. Determination of marital status. */
import { add, and, closedPredicate, gte, letIn, lte, not, or, variable } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import {
  joint_gross_income,
  legally_separated,
  married_stated,
  Person,
  year_bounds,
  year_marks,
} from "../schema";
import {
  abode_over_half,
  child_incl_step,
  cohabited_during,
  files_jointly,
  files_separately,
  gross_income_of,
  maintained_home_in,
  maintains_household,
  spouse_at_close,
} from "./helpers";
import { s151_c } from "./s151";
import { qualifying_child } from "./s152";

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
const A = variable("A");
const G = variable("G");
const G2 = variable("G2");

/**
 * (a)(1): the taxpayer and spouse are married as of the close of the taxable year, or, if
 * the spouse died during the year, as of the time of death.
 */
export const s7703_a_1 = closedPredicate("s7703_a_1", {
  taxpayer: Person,
  spouse: Person,
  year: Number,
});
/**
 * (a)(2): by the close of the year the taxpayer is legally separated from a spouse under a
 * decree of divorce or of separate maintenance.
 */
export const s7703_a_2 = closedPredicate("s7703_a_2", { taxpayer: Person, year: Number });
/** (a): married within the meaning of subsection (a) to the spouse: (a)(1) and not (a)(2). */
const s7703_a = closedPredicate("s7703_a", {
  taxpayer: Person,
  spouse: Person,
  year: Number,
});
/** Married within the meaning of subsection (a) to someone. */
const married_a = closedPredicate("married_a", { taxpayer: Person, year: Number });
/**
 * (b)(1): married within (a), files a separate return, and maintains as home a household
 * that is for more than half the year the principal place of abode of a child for whom a
 * §151 deduction is allowed.
 */
export const s7703_b_1 = closedPredicate("s7703_b_1", { taxpayer: Person, year: Number });
/** (b)(2): the taxpayer furnishes over half the cost of maintaining the household. */
export const s7703_b_2 = closedPredicate("s7703_b_2", { taxpayer: Person, year: Number });
/** (b)(3): the spouse is not a member of the household during the last six months. */
export const s7703_b_3 = closedPredicate("s7703_b_3", { taxpayer: Person, year: Number });
/** (b): all three hold, so the taxpayer is not considered married. */
export const s7703_b = closedPredicate("s7703_b", { taxpayer: Person, year: Number });
/**
 * Married for the year as §7703 determines it: married within (a) and not living apart
 * under (b), or stated outright by the text.
 */
export const married_7703 = closedPredicate("married_7703", { taxpayer: Person, year: Number });
/** Married under §7703 for the year and not making a joint return: filing separately. */
export const married_separate = closedPredicate("married_separate", {
  taxpayer: Person,
  year: Number,
});
/** The named spouse the taxpayer makes a joint return with for the year. */
export const joint_spouse = closedPredicate("joint_spouse", {
  taxpayer: Person,
  spouse: Person,
  year: Number,
});
const has_joint_spouse = closedPredicate("has_joint_spouse", { taxpayer: Person, year: Number });
/**
 * Adjusted gross income for the return: the taxpayer's gross income, plus the spouse's
 * when they make a joint return, as the reference formalization sums them. SARA has no
 * adjustments, so gross income stands for adjusted gross income.
 */
export const agi = closedPredicate("agi", { taxpayer: Person, year: Number, amount: Number });
/** The couple's gross income given as one figure, either way round. */
const combined_income = closedPredicate("combined_income", {
  taxpayer: Person,
  spouse: Person,
  year: Number,
  amount: Number,
});
const has_combined_income = closedPredicate("has_combined_income", {
  taxpayer: Person,
  spouse: Person,
  year: Number,
});

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
      // The reference formalization reads the deductible child as a qualifying child and
      // does not consult §151; the statute's deduction is accepted too.
      or(
        s151_c({ taxpayer: T, dependent: C, year: Y }),
        qualifying_child({ individual: C, taxpayer: T, year: Y }),
      ),
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
  kb.rule(married_separate({ taxpayer: T, year: Y })).iff(
    and(married_7703({ taxpayer: T, year: Y }), not(files_jointly({ person: T, year: Y }))),
  );
  kb.rule(joint_spouse({ taxpayer: T, spouse: S, year: Y })).iff(
    and(
      married_7703({ taxpayer: T, year: Y }),
      files_jointly({ person: T, year: Y }),
      spouse_at_close({ taxpayer: T, spouse: S, year: Y }),
    ),
  );
  kb.rule(has_joint_spouse({ taxpayer: T, year: Y })).iff(
    joint_spouse({ taxpayer: T, spouse: S, year: Y }),
  );
  // The couple's figure, whichever spouse the text states it for. Two figures that
  // disagree are both kept: the return then has two incomes, and no single tax.
  kb.rule(combined_income({ taxpayer: T, spouse: S, year: Y, amount: A })).iff(
    or(
      joint_gross_income({ person: T, year: Y, amount: A }),
      joint_gross_income({ person: S, year: Y, amount: A }),
    ),
  );
  kb.rule(has_combined_income({ taxpayer: T, spouse: S, year: Y })).iff(
    combined_income({ taxpayer: T, spouse: S, year: Y, amount: A }),
  );
  kb.rule(agi({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      // The text gives the couple's income as one figure.
      and(
        joint_spouse({ taxpayer: T, spouse: S, year: Y }),
        combined_income({ taxpayer: T, spouse: S, year: Y, amount: A }),
      ),
      and(
        joint_spouse({ taxpayer: T, spouse: S, year: Y }),
        not(has_combined_income({ taxpayer: T, spouse: S, year: Y })),
        gross_income_of({ person: T, year: Y, amount: G }),
        gross_income_of({ person: S, year: Y, amount: G2 }),
        letIn(A, add(G, G2), gte(A, 0)),
      ),
      and(
        not(has_joint_spouse({ taxpayer: T, year: Y })),
        gross_income_of({ person: T, year: Y, amount: A }),
      ),
    ),
  );
}
