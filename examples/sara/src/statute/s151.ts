/**
 * §151. Allowance of deductions for personal exemptions: who the exemptions are for, the
 * exemption amount of subsection (d), and the total of subsection (a).
 */
import {
  add,
  and,
  ceilTo,
  closedPredicate,
  count,
  div,
  gt,
  gte,
  letIn,
  lte,
  max,
  min,
  mul,
  neq,
  not,
  or,
  roundTo,
  sub,
  variable,
} from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { deduction_151c, exemption_151b, Person } from "../schema";
import {
  files_jointly,
  gross_income_of,
  has_income,
  has_stated,
  spouse_at_close,
  stated,
  stated_total,
} from "./helpers";
import { dependent_of } from "./s152";
import { applicable_amount } from "./s68";
import { married_separate } from "./s7703";

const T = variable("T");
const S = variable("S");
const D = variable("D");
const Y = variable("Y");
const X = variable("X");
const O = variable("O");
const A = variable("A");
const E = variable("E");
const G = variable("G");
const AA = variable("AA");
const P = variable("P");
const N = variable("N");
const NS = variable("NS");
const ND = variable("ND");
const ST = variable("ST");

const taxpayerYear = { taxpayer: Person, year: BigInt };
const valued = { ...taxpayerYear, amount: Number };

/**
 * (b): an exemption for the spouse: no joint return, and the spouse has no gross income
 * for the year and is not the dependent of another taxpayer. A stated exemption counts.
 */
export const s151_b = closedPredicate("s151_b", { taxpayer: Person, spouse: Person, year: BigInt });
/** (c): an exemption for a dependent of the taxpayer for the year. A stated deduction counts. */
export const s151_c = closedPredicate("s151_c", {
  taxpayer: Person,
  dependent: Person,
  year: BigInt,
});
/** The person is a dependent of some taxpayer for the year, in the sense of (b). */
const dependent_of_someone = closedPredicate("dependent_of_someone", {
  person: Person,
  year: BigInt,
});

// --- (d) Exemption amount ---

/**
 * (d)(2): a deduction under this section is allowable to another taxpayer for the
 * individual, so the individual's own exemption amount is zero.
 */
export const s151_d_2 = closedPredicate("s151_d_2", taxpayerYear);
/** (d)(2) with its amount: zero, when it applies. */
export const s151_d_2_amount = closedPredicate("s151_d_2_amount", valued);
/** The $2,500 step of (d)(3)(B), or $1,250 for a married individual filing separately. */
const phaseout_step = closedPredicate("phaseout_step", valued);
/**
 * (d)(3)(B): the applicable percentage, 2 points for each step or fraction of a step by
 * which adjusted gross income exceeds the applicable amount of §68(b), at most 100.
 */
export const s151_d_3_B = closedPredicate("s151_d_3_B", valued);
/** (d)(3)(A): the exemption amount reduced by the applicable percentage. */
export const s151_d_3_A = closedPredicate("s151_d_3_A", valued);
/** (d)(5): the exemption amount is zero for taxable years 2018 through 2025. */
export const s151_d_5 = closedPredicate("s151_d_5", taxpayerYear);
/** (d): the exemption amount for the taxpayer and year, stated or derived. */
export const exemption_amount = closedPredicate("exemption_amount_151d", valued);
/** The number of spouses the taxpayer has an exemption for under (b): 0 or 1. */
const spouse_exemptions = closedPredicate("spouse_exemptions", valued);
/** The exemptions for dependents under (c), as an amount: stated, or counted at the exemption amount. */
const dependent_exemptions = closedPredicate("dependent_exemptions", valued);
/**
 * (a): the taxpayer's total exemptions for the year: one for themself, one for a spouse
 * under (b), and one for each dependent under (c), each of the exemption amount; or the
 * total the text states for the section.
 */
export const s151_a = closedPredicate("s151_a", valued);

export function defineS151(kb: KnowledgeBase): void {
  kb.rule(dependent_of_someone({ person: S, year: Y })).iff(
    dependent_of({ dependent: S, taxpayer: X, year: Y }),
  );
  kb.rule(s151_b({ taxpayer: T, spouse: S, year: Y })).iff(
    or(
      exemption_151b.undated({ taxpayer: T, spouse: S }),
      exemption_151b.inYear({ taxpayer: T, spouse: S, year: Y }),
      and(
        spouse_at_close({ taxpayer: T, spouse: S, year: Y }),
        not(files_jointly({ person: T, year: Y })),
        not(has_income({ person: S, year: Y })),
        not(dependent_of_someone({ person: S, year: Y })),
      ),
    ),
  );
  kb.rule(s151_c({ taxpayer: T, dependent: D, year: Y })).iff(
    or(
      deduction_151c.undated({ taxpayer: T, dependent: D }),
      deduction_151c.inYear({ taxpayer: T, dependent: D, year: Y }),
      dependent_of({ dependent: D, taxpayer: T, year: Y }),
    ),
  );

  // (d) Exemption amount.
  kb.rule(s151_d_2({ taxpayer: T, year: Y })).iff(
    and(
      or(
        s151_b({ taxpayer: O, spouse: T, year: Y }),
        s151_c({ taxpayer: O, dependent: T, year: Y }),
      ),
      neq(O, T),
    ),
  );
  kb.rule(s151_d_2_amount({ taxpayer: T, year: Y, amount: A })).iff(
    and(s151_d_2({ taxpayer: T, year: Y }), letIn(A, 0, gte(A, 0))),
  );
  kb.rule(phaseout_step({ taxpayer: T, year: Y, amount: ST })).iff(
    or(
      and(married_separate({ taxpayer: T, year: Y }), letIn(ST, 1250, gte(ST, 0))),
      and(not(married_separate({ taxpayer: T, year: Y })), letIn(ST, 2500, gte(ST, 0))),
    ),
  );
  kb.rule(s151_d_3_B({ taxpayer: T, year: Y, amount: P })).iff(
    and(
      gross_income_of({ person: T, year: Y, amount: G }),
      applicable_amount({ taxpayer: T, year: Y, amount: AA }),
      phaseout_step({ taxpayer: T, year: Y, amount: ST }),
      letIn(E, max(sub(G, AA), 0), letIn(P, min(mul(2, ceilTo(div(E, ST), 0)), 100), gte(P, 0))),
    ),
  );
  kb.rule(s151_d_3_A({ taxpayer: T, year: Y, amount: A })).iff(
    and(
      gross_income_of({ person: T, year: Y, amount: G }),
      applicable_amount({ taxpayer: T, year: Y, amount: AA }),
      gt(G, AA),
      s151_d_3_B({ taxpayer: T, year: Y, amount: P }),
      letIn(A, max(sub(2000, div(roundTo(mul(2000, P), -2), 100)), 0), gte(A, 0)),
    ),
  );
  kb.rule(s151_d_5({ taxpayer: T, year: Y })).iff(and(gte(Y, 2018n), lte(Y, 2025n)));
  kb.rule(exemption_amount({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      stated({ person: T, year: Y, kind: "exemption_amount_151d", amount: A }),
      and(
        not(has_stated({ person: T, year: Y, kind: "exemption_amount_151d" })),
        or(
          and(s151_d_2({ taxpayer: T, year: Y }), letIn(A, 0, gte(A, 0))),
          and(
            not(s151_d_2({ taxpayer: T, year: Y })),
            s151_d_5({ taxpayer: T, year: Y }),
            letIn(A, 0, gte(A, 0)),
          ),
          and(
            not(s151_d_2({ taxpayer: T, year: Y })),
            not(s151_d_5({ taxpayer: T, year: Y })),
            or(
              s151_d_3_A({ taxpayer: T, year: Y, amount: A }),
              and(
                gross_income_of({ person: T, year: Y, amount: G }),
                applicable_amount({ taxpayer: T, year: Y, amount: AA }),
                lte(G, AA),
                letIn(A, 2000, gte(A, 0)),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  // (a) Total exemptions.
  kb.rule(spouse_exemptions({ taxpayer: T, year: Y, amount: N })).iff(
    letIn(N, count(S).where(s151_b({ taxpayer: T, spouse: S, year: Y })), gte(N, 0)),
  );
  kb.rule(dependent_exemptions({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      and(
        has_stated({ person: T, year: Y, kind: "exemption_151c" }),
        stated_total({ person: T, year: Y, kind: "exemption_151c", amount: A }),
      ),
      and(
        not(has_stated({ person: T, year: Y, kind: "exemption_151c" })),
        exemption_amount({ taxpayer: T, year: Y, amount: E }),
        letIn(
          N,
          count(D).where(s151_c({ taxpayer: T, dependent: D, year: Y })),
          letIn(A, mul(E, N), gte(A, 0)),
        ),
      ),
    ),
  );
  kb.rule(s151_a({ taxpayer: T, year: Y, amount: A })).iff(
    or(
      and(
        has_stated({ person: T, year: Y, kind: "exemption_151" }),
        stated_total({ person: T, year: Y, kind: "exemption_151", amount: A }),
      ),
      and(
        not(has_stated({ person: T, year: Y, kind: "exemption_151" })),
        exemption_amount({ taxpayer: T, year: Y, amount: E }),
        spouse_exemptions({ taxpayer: T, year: Y, amount: NS }),
        dependent_exemptions({ taxpayer: T, year: Y, amount: ND }),
        letIn(A, add(mul(E, add(1, NS)), ND), gte(A, 0)),
      ),
    ),
  );
}
