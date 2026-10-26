/**
 * §1. Tax imposed: the four rate schedules of subsections (a) to (d), each with its five
 * brackets, applied to taxable income under §63. Each bracket is its own predicate because
 * a question may ask about one bracket, which is false when the income lies in another.
 * The tax is rounded to whole dollars, as the reference formalization rounds it.
 */
import {
  add,
  and,
  closedPredicate,
  gt,
  gte,
  letIn,
  lte,
  mul,
  not,
  or,
  roundTo,
  sub,
  variable,
} from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { Person } from "../schema";
import { files_jointly } from "./helpers";
import { head_of_household, surviving_spouse } from "./s2";
import { taxable_income_of } from "./s63";
import { married_7703, married_separate } from "./s7703";

const T = variable("T");
const Y = variable("Y");
const I = variable("I");
const A = variable("A");

const taxpayerYear = { taxpayer: Person, year: Number };
const valued = { ...taxpayerYear, amount: Number };

/** (a): a married individual making a joint return, or a surviving spouse. */
const s1_a_status = closedPredicate("s1_a_status", taxpayerYear);
/** (b): a head of household. */
const s1_b_status = closedPredicate("s1_b_status", taxpayerYear);
/** (c): not married, and neither a surviving spouse nor a head of household. */
const s1_c_status = closedPredicate("s1_c_status", taxpayerYear);
/** (d): a married individual not making a joint return. */
const s1_d_status = closedPredicate("s1_d_status", taxpayerYear);
/** (a)(i): the tax for married individuals filing joint returns and surviving spouses with taxable income in this bracket. */
export const s1_a_i = closedPredicate("s1_a_i", valued);
/** (a)(ii): the tax for married individuals filing joint returns and surviving spouses with taxable income in this bracket. */
export const s1_a_ii = closedPredicate("s1_a_ii", valued);
/** (a)(iii): the tax for married individuals filing joint returns and surviving spouses with taxable income in this bracket. */
export const s1_a_iii = closedPredicate("s1_a_iii", valued);
/** (a)(iv): the tax for married individuals filing joint returns and surviving spouses with taxable income in this bracket. */
export const s1_a_iv = closedPredicate("s1_a_iv", valued);
/** (a)(v): the tax for married individuals filing joint returns and surviving spouses with taxable income in this bracket. */
export const s1_a_v = closedPredicate("s1_a_v", valued);
/** (a): the tax for married individuals filing joint returns and surviving spouses. */
export const s1_a = closedPredicate("s1_a", valued);
/** (b)(i): the tax for heads of households with taxable income in this bracket. */
export const s1_b_i = closedPredicate("s1_b_i", valued);
/** (b)(ii): the tax for heads of households with taxable income in this bracket. */
export const s1_b_ii = closedPredicate("s1_b_ii", valued);
/** (b)(iii): the tax for heads of households with taxable income in this bracket. */
export const s1_b_iii = closedPredicate("s1_b_iii", valued);
/** (b)(iv): the tax for heads of households with taxable income in this bracket. */
export const s1_b_iv = closedPredicate("s1_b_iv", valued);
/** (b)(v): the tax for heads of households with taxable income in this bracket. */
export const s1_b_v = closedPredicate("s1_b_v", valued);
/** (b): the tax for heads of households. */
export const s1_b = closedPredicate("s1_b", valued);
/** (c)(i): the tax for unmarried individuals other than surviving spouses and heads of households with taxable income in this bracket. */
export const s1_c_i = closedPredicate("s1_c_i", valued);
/** (c)(ii): the tax for unmarried individuals other than surviving spouses and heads of households with taxable income in this bracket. */
export const s1_c_ii = closedPredicate("s1_c_ii", valued);
/** (c)(iii): the tax for unmarried individuals other than surviving spouses and heads of households with taxable income in this bracket. */
export const s1_c_iii = closedPredicate("s1_c_iii", valued);
/** (c)(iv): the tax for unmarried individuals other than surviving spouses and heads of households with taxable income in this bracket. */
export const s1_c_iv = closedPredicate("s1_c_iv", valued);
/** (c)(v): the tax for unmarried individuals other than surviving spouses and heads of households with taxable income in this bracket. */
export const s1_c_v = closedPredicate("s1_c_v", valued);
/** (c): the tax for unmarried individuals other than surviving spouses and heads of households. */
export const s1_c = closedPredicate("s1_c", valued);
/** (d)(i): the tax for married individuals filing separate returns with taxable income in this bracket. */
export const s1_d_i = closedPredicate("s1_d_i", valued);
/** (d)(ii): the tax for married individuals filing separate returns with taxable income in this bracket. */
export const s1_d_ii = closedPredicate("s1_d_ii", valued);
/** (d)(iii): the tax for married individuals filing separate returns with taxable income in this bracket. */
export const s1_d_iii = closedPredicate("s1_d_iii", valued);
/** (d)(iv): the tax for married individuals filing separate returns with taxable income in this bracket. */
export const s1_d_iv = closedPredicate("s1_d_iv", valued);
/** (d)(v): the tax for married individuals filing separate returns with taxable income in this bracket. */
export const s1_d_v = closedPredicate("s1_d_v", valued);
/** (d): the tax for married individuals filing separate returns. */
export const s1_d = closedPredicate("s1_d", valued);
/** The tax imposed by this section, under whichever subsection applies. */
export const s1_tax = closedPredicate("s1_tax", valued);

export function defineS1(kb: KnowledgeBase): void {
  kb.rule(s1_a_status({ taxpayer: T, year: Y })).iff(
    or(
      and(married_7703({ taxpayer: T, year: Y }), files_jointly({ person: T, year: Y })),
      surviving_spouse({ taxpayer: T, year: Y }),
    ),
  );
  kb.rule(s1_b_status({ taxpayer: T, year: Y })).iff(head_of_household({ taxpayer: T, year: Y }));
  kb.rule(s1_c_status({ taxpayer: T, year: Y })).iff(
    and(
      not(married_7703({ taxpayer: T, year: Y })),
      not(surviving_spouse({ taxpayer: T, year: Y })),
      not(head_of_household({ taxpayer: T, year: Y })),
    ),
  );
  kb.rule(s1_d_status({ taxpayer: T, year: Y })).iff(married_separate({ taxpayer: T, year: Y }));
  kb.rule(s1_a_i({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_a_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      lte(I, 36_900),
      letIn(A, roundTo(mul(I, 0.15), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_a_ii({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_a_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 36_900),
      lte(I, 89_150),
      letIn(A, roundTo(add(5535, mul(sub(I, 36_900), 0.28)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_a_iii({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_a_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 89_150),
      lte(I, 140_000),
      letIn(A, roundTo(add(20_165, mul(sub(I, 89_150), 0.31)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_a_iv({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_a_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 140_000),
      lte(I, 250_000),
      letIn(A, roundTo(add(35_928.5, mul(sub(I, 140_000), 0.36)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_a_v({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_a_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 250_000),
      letIn(A, roundTo(add(75_528.5, mul(sub(I, 250_000), 0.396)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_a({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      s1_a_i({ taxpayer: T, year: Y, amount: A }),
      s1_a_ii({ taxpayer: T, year: Y, amount: A }),
      s1_a_iii({ taxpayer: T, year: Y, amount: A }),
      s1_a_iv({ taxpayer: T, year: Y, amount: A }),
      s1_a_v({ taxpayer: T, year: Y, amount: A }),
    ),
  );
  kb.rule(s1_b_i({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_b_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      lte(I, 29_600),
      letIn(A, roundTo(mul(I, 0.15), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_b_ii({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_b_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 29_600),
      lte(I, 76_400),
      letIn(A, roundTo(add(4440, mul(sub(I, 29_600), 0.28)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_b_iii({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_b_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 76_400),
      lte(I, 127_500),
      letIn(A, roundTo(add(17_544, mul(sub(I, 76_400), 0.31)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_b_iv({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_b_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 127_500),
      lte(I, 250_000),
      letIn(A, roundTo(add(33_385, mul(sub(I, 127_500), 0.36)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_b_v({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_b_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 250_000),
      letIn(A, roundTo(add(77_485, mul(sub(I, 250_000), 0.396)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_b({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      s1_b_i({ taxpayer: T, year: Y, amount: A }),
      s1_b_ii({ taxpayer: T, year: Y, amount: A }),
      s1_b_iii({ taxpayer: T, year: Y, amount: A }),
      s1_b_iv({ taxpayer: T, year: Y, amount: A }),
      s1_b_v({ taxpayer: T, year: Y, amount: A }),
    ),
  );
  kb.rule(s1_c_i({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_c_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      lte(I, 22_100),
      letIn(A, roundTo(mul(I, 0.15), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_c_ii({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_c_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 22_100),
      lte(I, 53_500),
      letIn(A, roundTo(add(3315, mul(sub(I, 22_100), 0.28)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_c_iii({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_c_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 53_500),
      lte(I, 115_000),
      letIn(A, roundTo(add(12_107, mul(sub(I, 53_500), 0.31)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_c_iv({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_c_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 115_000),
      lte(I, 250_000),
      letIn(A, roundTo(add(31_172, mul(sub(I, 115_000), 0.36)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_c_v({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_c_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 250_000),
      letIn(A, roundTo(add(79_772, mul(sub(I, 250_000), 0.396)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_c({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      s1_c_i({ taxpayer: T, year: Y, amount: A }),
      s1_c_ii({ taxpayer: T, year: Y, amount: A }),
      s1_c_iii({ taxpayer: T, year: Y, amount: A }),
      s1_c_iv({ taxpayer: T, year: Y, amount: A }),
      s1_c_v({ taxpayer: T, year: Y, amount: A }),
    ),
  );
  kb.rule(s1_d_i({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_d_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      lte(I, 18_450),
      letIn(A, roundTo(mul(I, 0.15), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_d_ii({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_d_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 18_450),
      lte(I, 44_575),
      letIn(A, roundTo(add(2767.5, mul(sub(I, 18_450), 0.28)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_d_iii({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_d_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 44_575),
      lte(I, 70_000),
      letIn(A, roundTo(add(10_082.5, mul(sub(I, 44_575), 0.31)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_d_iv({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_d_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 70_000),
      lte(I, 125_000),
      letIn(A, roundTo(add(17_964.25, mul(sub(I, 70_000), 0.36)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_d_v({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      s1_d_status({ taxpayer: T, year: Y }),
      taxable_income_of({ taxpayer: T, year: Y, amount: I }),
      gt(I, 125_000),
      letIn(A, roundTo(add(37_764.25, mul(sub(I, 125_000), 0.396)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s1_d({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      s1_d_i({ taxpayer: T, year: Y, amount: A }),
      s1_d_ii({ taxpayer: T, year: Y, amount: A }),
      s1_d_iii({ taxpayer: T, year: Y, amount: A }),
      s1_d_iv({ taxpayer: T, year: Y, amount: A }),
      s1_d_v({ taxpayer: T, year: Y, amount: A }),
    ),
  );
  kb.rule(s1_tax({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      s1_a({ taxpayer: T, year: Y, amount: A }),
      s1_b({ taxpayer: T, year: Y, amount: A }),
      s1_c({ taxpayer: T, year: Y, amount: A }),
      s1_d({ taxpayer: T, year: Y, amount: A }),
    ),
  );
}
