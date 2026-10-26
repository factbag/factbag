/**
 * The tax a person has to pay for a year, as SARA's numeric questions ask it: the income
 * tax of §1, or nothing when no schedule applies, plus the unemployment tax of §3301, or
 * nothing when the person is not an employer. Each part is already in whole dollars.
 */
import { add, and, closedPredicate, gte, letIn, not, or, variable } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { Person } from "../schema";
import { s1_tax } from "./s1";
import { s3301, s3306_a } from "./s3306";

const T = variable("T");
const Y = variable("Y");
const A = variable("A");
const I = variable("I");
const E = variable("E");

const valued = { taxpayer: Person, year: Number, amount: Number };

/** The income tax under §1, or 0 when no schedule applies. */
export const income_tax = closedPredicate("income_tax", valued);
const has_income_tax = closedPredicate("has_income_tax", { taxpayer: Person, year: Number });
/** The unemployment tax under §3301, or 0 when the person is not an employer. */
export const employment_tax = closedPredicate("employment_tax", valued);
/** The tax the person has to pay for the year. */
export const tax_owed = closedPredicate("tax_owed", valued);

export function defineTax(kb: KnowledgeBase): void {
  kb.rule(has_income_tax({ taxpayer: T, year: Y })).iff(
    s1_tax({ taxpayer: T, year: Y, amount: A }),
  );
  kb.rule(income_tax({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      s1_tax({ taxpayer: T, year: Y, amount: A }),
      and(not(has_income_tax({ taxpayer: T, year: Y })), letIn(A, 0, gte(A, 0))),
    ),
  );
  kb.rule(employment_tax({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      s3301({ employer: T, year: Y, amount: A }),
      and(not(s3306_a({ employer: T, year: Y })), letIn(A, 0, gte(A, 0))),
    ),
  );
  kb.rule(tax_owed({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      income_tax({ taxpayer: T, year: Y, amount: I }),
      employment_tax({ taxpayer: T, year: Y, amount: E }),
      letIn(A, add(I, E), gte(A, 0)),
    ),
  );
}
