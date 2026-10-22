/** §152. Dependent defined: the qualifying child tests of subsection (c). */
import { and, closedPredicate, gt, not, or, variable } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { born, Person, year_bounds } from "../schema";
import { descendant_of, has_birth, sibling } from "./helpers";

const I = variable("I");
const T = variable("T");
const S = variable("S");
const Y = variable("Y");
const F = variable("F");
const L = variable("L");
const U = variable("U");
const BI = variable("BI");
const BT = variable("BT");

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
