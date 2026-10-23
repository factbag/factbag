/** §68. Overall limitation on itemized deductions: the applicable amount and the reduction. */
import {
  and,
  closedPredicate,
  div,
  gt,
  gte,
  letIn,
  lte,
  min,
  mul,
  not,
  or,
  roundTo,
  sub,
  variable,
} from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { Person } from "../schema";
import { files_jointly, gross_income_of, has_stated, itemized_total, stated } from "./helpers";
import { head_of_household, surviving_spouse } from "./s2";
import { married_7703, married_separate } from "./s7703";

const T = variable("T");
const Y = variable("Y");
const A = variable("A");
const G = variable("G");
const I = variable("I");
const R = variable("R");
const R1 = variable("R1");
const R2 = variable("R2");

const taxpayerYear = { taxpayer: Person, year: BigInt };
const valued = { ...taxpayerYear, amount: Number };

/** (b)(1)(A): a joint return or a surviving spouse. */
export const s68_b_1_A = closedPredicate("s68_b_1_A", taxpayerYear);
/** (b)(1)(B): a head of household. */
export const s68_b_1_B = closedPredicate("s68_b_1_B", taxpayerYear);
/** (b)(1)(C): not married, and neither a surviving spouse nor a head of household. */
export const s68_b_1_C = closedPredicate("s68_b_1_C", taxpayerYear);
/** (b)(1)(D): a married individual filing a separate return. */
export const s68_b_1_D = closedPredicate("s68_b_1_D", taxpayerYear);
/** (b)(1)(A) to (D) with their amounts: $300,000, $275,000, $250,000 and half of (A). */
export const s68_b_1_A_amount = closedPredicate("s68_b_1_A_amount", valued);
export const s68_b_1_B_amount = closedPredicate("s68_b_1_B_amount", valued);
export const s68_b_1_C_amount = closedPredicate("s68_b_1_C_amount", valued);
export const s68_b_1_D_amount = closedPredicate("s68_b_1_D_amount", valued);
/** (b): the applicable amount for the taxpayer and year, stated or by (b)(1). */
export const applicable_amount = closedPredicate("applicable_amount_68b", valued);
/** Adjusted gross income exceeds the applicable amount, so (a) reduces the deductions. */
export const s68_applies = closedPredicate("s68_applies", taxpayerYear);
/** (a)(1): 3 percent of the excess of adjusted gross income over the applicable amount. */
export const s68_a_1 = closedPredicate("s68_a_1", valued);
/** (a)(2): 80 percent of the itemized deductions otherwise allowable. */
export const s68_a_2 = closedPredicate("s68_a_2", valued);
/** (a): the reduction, the lesser of (a)(1) and (a)(2), when the section applies. */
export const s68_a = closedPredicate("s68_a", valued);
/** (f): the section does not apply to taxable years 2018 through 2025. */
export const s68_f = closedPredicate("s68_f", taxpayerYear);
/** The itemized deductions after this section's reduction, if any. */
export const itemized_after_68 = closedPredicate("itemized_after_68", valued);

export function defineS68(kb: KnowledgeBase): void {
  kb.rule(s68_b_1_A({ taxpayer: T, year: Y })).iff(
    or(
      and(married_7703({ taxpayer: T, year: Y }), files_jointly({ person: T, year: Y })),
      surviving_spouse({ taxpayer: T, year: Y }),
    ),
  );
  kb.rule(s68_b_1_B({ taxpayer: T, year: Y })).iff(head_of_household({ taxpayer: T, year: Y }));
  kb.rule(s68_b_1_C({ taxpayer: T, year: Y })).iff(
    and(
      not(married_7703({ taxpayer: T, year: Y })),
      not(surviving_spouse({ taxpayer: T, year: Y })),
      not(head_of_household({ taxpayer: T, year: Y })),
    ),
  );
  kb.rule(s68_b_1_D({ taxpayer: T, year: Y })).iff(married_separate({ taxpayer: T, year: Y }));
  kb.rule(s68_b_1_A_amount({ taxpayer: T, year: Y, amount: A })).iff(
    and(s68_b_1_A({ taxpayer: T, year: Y }), letIn(A, 300_000, gte(A, 0))),
  );
  kb.rule(s68_b_1_B_amount({ taxpayer: T, year: Y, amount: A })).iff(
    and(s68_b_1_B({ taxpayer: T, year: Y }), letIn(A, 275_000, gte(A, 0))),
  );
  kb.rule(s68_b_1_C_amount({ taxpayer: T, year: Y, amount: A })).iff(
    and(s68_b_1_C({ taxpayer: T, year: Y }), letIn(A, 250_000, gte(A, 0))),
  );
  kb.rule(s68_b_1_D_amount({ taxpayer: T, year: Y, amount: A })).iff(
    and(s68_b_1_D({ taxpayer: T, year: Y }), letIn(A, 150_000, gte(A, 0))),
  );
  kb.rule(applicable_amount({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      stated({ person: T, year: Y, kind: "applicable_amount_68b", amount: A }),
      and(
        not(has_stated({ person: T, year: Y, kind: "applicable_amount_68b" })),
        or(
          s68_b_1_A_amount({ taxpayer: T, year: Y, amount: A }),
          s68_b_1_B_amount({ taxpayer: T, year: Y, amount: A }),
          s68_b_1_C_amount({ taxpayer: T, year: Y, amount: A }),
          s68_b_1_D_amount({ taxpayer: T, year: Y, amount: A }),
        ),
      ),
    ),
  );
  kb.rule(s68_applies({ taxpayer: T, year: Y })).iff(
    and(
      gross_income_of({ person: T, year: Y, amount: G }),
      applicable_amount({ taxpayer: T, year: Y, amount: A }),
      gt(G, A),
    ),
  );
  kb.rule(s68_a_1({ taxpayer: T, year: Y, amount: R })).iff(
    and(
      gross_income_of({ person: T, year: Y, amount: G }),
      applicable_amount({ taxpayer: T, year: Y, amount: A }),
      gt(G, A),
      letIn(R, div(roundTo(mul(3, sub(G, A)), -2), 100), gte(R, 0)),
    ),
  );
  kb.rule(s68_a_2({ taxpayer: T, year: Y, amount: R })).iff(
    and(
      itemized_total({ person: T, year: Y, amount: I }),
      letIn(R, div(roundTo(mul(80, I), -2), 100), gte(R, 0)),
    ),
  );
  kb.rule(s68_a({ taxpayer: T, year: Y, amount: R })).iff(
    and(
      s68_a_1({ taxpayer: T, year: Y, amount: R1 }),
      s68_a_2({ taxpayer: T, year: Y, amount: R2 }),
      letIn(R, min(R1, R2), gte(R, 0)),
    ),
  );
  kb.rule(s68_f({ taxpayer: T, year: Y })).iff(and(gte(Y, 2018n), lte(Y, 2025n)));
  kb.rule(itemized_after_68({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      itemized_total({ person: T, year: Y, amount: I }),
      or(
        and(s68_f({ taxpayer: T, year: Y }), letIn(A, I, gte(A, 0))),
        and(
          not(s68_f({ taxpayer: T, year: Y })),
          not(s68_applies({ taxpayer: T, year: Y })),
          letIn(A, I, gte(A, 0)),
        ),
        and(
          not(s68_f({ taxpayer: T, year: Y })),
          s68_a({ taxpayer: T, year: Y, amount: R }),
          letIn(A, sub(I, R), gte(A, 0)),
        ),
      ),
    ),
  );
}
