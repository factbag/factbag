/** §151. Allowance of deductions for personal exemptions: who the exemptions are for. */
import { and, closedPredicate, not, or, variable } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { deduction_151c, exemption_151b, Person } from "../schema";
import { files_jointly, has_income, spouse_at_close } from "./helpers";
import { dependent_of } from "./s152";

const T = variable("T");
const S = variable("S");
const D = variable("D");
const Y = variable("Y");
const X = variable("X");

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
}
