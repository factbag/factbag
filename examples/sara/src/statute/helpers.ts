/**
 * Derived relationships the sections share: a marriage with its start, how and when it
 * ended, whether two people were married on a given day, and a person's nonresident alien
 * status over a date range. Each is a closed predicate defined by one `iff`, so a false
 * answer is a definite false and the sections may negate it.
 *
 * Every fact predicate names its two people in some order; the helpers accept either order
 * so the grounding step never has to canonicalise.
 */
import { and, closedPredicate, gt, gte, letIn, lte, not, or, variable } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { NEG_INF } from "../calendar";
import {
  born,
  child_of,
  died,
  legally_separated,
  married_on,
  married_undated,
  nonresident_alien,
  nonresident_alien_since,
  nonresident_alien_until,
  Person,
  sibling_of,
} from "../schema";

const A = variable("A");
const B = variable("B");
const P = variable("P");
const S = variable("S");
const E = variable("E");
const D = variable("D");
const F = variable("F");
const L = variable("L");
const M = variable("M");
const M1 = variable("M1");
const M2 = variable("M2");

/** The two people married on `start`; an undated marriage starts at the sentinel −∞. */
export const marriage = closedPredicate("marriage", { a: Person, b: Person, start: Date });
/** Some dated marriage between the two, in either order. */
const dated_marriage = closedPredicate("dated_marriage", { a: Person, b: Person });
/** The marriage of the two ended on `end`: a spouse died, or a decree of divorce. */
const marriage_ended = closedPredicate("marriage_ended", {
  a: Person,
  b: Person,
  end: Date,
});
/** The marriage of the two ended strictly before `day`. */
const ended_before = closedPredicate("ended_before", {
  a: Person,
  b: Person,
  day: Date,
});
/** The two were married to each other on `day`, counting the day a spouse died. */
export const married_at = closedPredicate("married_at", { a: Person, b: Person, day: Date });
/** The person died on a day in the closed range `[first, last]`. */
export const died_during = closedPredicate("died_during", {
  person: Person,
  first: Date,
  last: Date,
});
/** The person was a nonresident alien at some time in the closed range `[first, last]`. */
export const nra_during = closedPredicate("nra_during", {
  person: Person,
  first: Date,
  last: Date,
});
const has_nra_since = closedPredicate("has_nra_since", { person: Person });
const has_nra_until = closedPredicate("has_nra_until", { person: Person });
export const has_birth = closedPredicate("has_birth", { person: Person });
/** Sibling in either order. */
export const sibling = closedPredicate("sibling", { a: Person, b: Person });
/** Child, grandchild or great-grandchild: a fixed-depth descendant. */
export const descendant_of = closedPredicate("descendant_of", {
  descendant: Person,
  ancestor: Person,
});

export function defineHelpers(kb: KnowledgeBase): void {
  kb.rule(dated_marriage({ a: A, b: B })).iff(
    or(married_on({ a: A, b: B, day: D }), married_on({ a: B, b: A, day: D })),
  );
  kb.rule(marriage({ a: A, b: B, start: S })).iff(
    or(
      married_on({ a: A, b: B, day: S }),
      married_on({ a: B, b: A, day: S }),
      and(
        or(married_undated({ a: A, b: B }), married_undated({ a: B, b: A })),
        not(dated_marriage({ a: A, b: B })),
        letIn(S, NEG_INF, gte(S, S)),
      ),
    ),
  );
  kb.rule(marriage_ended({ a: A, b: B, end: E })).iff(
    or(
      died({ person: A, day: E }),
      died({ person: B, day: E }),
      legally_separated({ a: A, b: B, decree: "divorce", day: E }),
      legally_separated({ a: B, b: A, decree: "divorce", day: E }),
    ),
  );
  kb.rule(ended_before({ a: A, b: B, day: D })).iff(
    and(marriage_ended({ a: A, b: B, end: E }), gt(D, E)),
  );
  kb.rule(married_at({ a: A, b: B, day: D })).iff(
    and(marriage({ a: A, b: B, start: S }), lte(S, D), not(ended_before({ a: A, b: B, day: D }))),
  );
  kb.rule(died_during({ person: P, first: F, last: L })).iff(
    and(died({ person: P, day: D }), gte(D, F), lte(D, L)),
  );
  kb.rule(has_nra_since({ person: P })).iff(nonresident_alien_since({ person: P, day: D }));
  kb.rule(has_nra_until({ person: P })).iff(nonresident_alien_until({ person: P, day: D }));
  kb.rule(nra_during({ person: P, first: F, last: L })).iff(
    or(
      nonresident_alien({ person: P }),
      and(
        nonresident_alien_since({ person: P, day: S }),
        lte(S, L),
        not(has_nra_until({ person: P })),
      ),
      and(
        nonresident_alien_until({ person: P, day: E }),
        gte(E, F),
        not(has_nra_since({ person: P })),
      ),
      and(
        nonresident_alien_since({ person: P, day: S }),
        nonresident_alien_until({ person: P, day: E }),
        lte(S, L),
        gte(E, F),
      ),
    ),
  );
  kb.rule(has_birth({ person: P })).iff(born({ person: P, day: D }));
  kb.rule(sibling({ a: A, b: B })).iff(or(sibling_of({ a: A, b: B }), sibling_of({ a: B, b: A })));
  kb.rule(descendant_of({ descendant: A, ancestor: B })).iff(
    or(
      child_of({ child: A, parent: B }),
      and(child_of({ child: A, parent: M }), child_of({ child: M, parent: B })),
      and(
        child_of({ child: A, parent: M1 }),
        child_of({ child: M1, parent: M2 }),
        child_of({ child: M2, parent: B }),
      ),
    ),
  );
}
