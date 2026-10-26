/**
 * Derived relationships the sections share: a marriage with its start, how and when it
 * ended, whether two people were married on a given day, a person's nonresident alien
 * status over a date range, who shared a home when, and who maintained one. Each is a
 * closed predicate defined by one `iff`, so a false answer is a definite false and the
 * sections may negate it.
 *
 * Every fact predicate names its two people in some order; the helpers accept either order
 * so the grounding step never has to canonicalise.
 */
import {
  add,
  and,
  closedPredicate,
  daysBetween,
  gt,
  gte,
  letIn,
  lte,
  not,
  or,
  sum,
  variable,
} from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { NEG_INF } from "../calendar";
import {
  AMOUNT_KINDS,
  blind,
  born,
  child_of,
  died,
  passed_away,
  home_cost_share,
  joint_return,
  legally_separated,
  maintains_home,
  married_on,
  married_undated,
  nonresident_alien,
  nonresident_alien_since,
  nonresident_alien_until,
  Person,
  separate_return,
  shares_home,
  sibling_of,
  stated_amount,
  stepchild_of,
  year_bounds,
  year_marks,
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
const Y = variable("Y");
const X = variable("X");
const J = variable("J");
const H = variable("H");
const F2 = variable("F2");
const L2 = variable("L2");
const X2 = variable("X2");
const K = variable("K");
const T = variable("T");

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
/**
 * The spouse as §7703(a)(1) determines it: married as of the close of the year, or, if the
 * spouse died during the year, as of the time of death.
 */
export const spouse_at_close = closedPredicate("spouse_at_close", {
  taxpayer: Person,
  spouse: Person,
  year: Number,
});
/**
 * The day the person died: the stated day, or the last day of the year when the text gives
 * only the year of death.
 */
export const death_day = closedPredicate("death_day", { person: Person, day: Date });
const has_death_date = closedPredicate("has_death_date", { person: Person });
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
/** The two were married to each other at some time, in either order. */
export const spouses = closedPredicate("spouses", { a: Person, b: Person });
/**
 * Stepparent: stated as such, or the spouse of a parent who is not a parent. The statute
 * names the relation and SARA builds it from a marriage, so both readings are needed.
 */
export const stepparent_of = closedPredicate("stepparent_of", {
  stepparent: Person,
  child: Person,
});
/** Child in the sense of §152(f)(1): son, daughter, adopted child or stepchild. */
export const child_incl_step = closedPredicate("child_incl_step", {
  child: Person,
  parent: Person,
});
/** Child, grandchild or great-grandchild: a fixed-depth descendant. */
export const descendant_of = closedPredicate("descendant_of", {
  descendant: Person,
  ancestor: Person,
});

// --- Sharing a home ---

/** The two shared a home at some time in the closed range `[first, last]`. */
export const cohabited_during = closedPredicate("cohabited_during", {
  a: Person,
  b: Person,
  first: Date,
  last: Date,
});
/** The two shared a home at some time in the year. */
export const cohabited_in = closedPredicate("cohabited_in", {
  a: Person,
  b: Person,
  year: Number,
});
/** The two had the same principal place of abode for more than one-half of the year. */
export const abode_over_half = closedPredicate("abode_over_half", {
  a: Person,
  b: Person,
  year: Number,
});
const cohabited_undated = closedPredicate("cohabited_undated", { a: Person, b: Person });
const cohabited_year = closedPredicate("cohabited_year", { a: Person, b: Person, year: Number });
/** The text dates the cohabitation to the day at one end or both. */
const cohabitation_dated = closedPredicate("cohabitation_dated", { a: Person, b: Person });
/**
 * Some stated year of cohabitation overlaps the range. A per-year fact stands for the
 * whole year, as the dataset encodes a year-only statement; it counts only when the text
 * gives no exact days for the pair, since an exact start or end is the finer statement of
 * the same stay.
 */
const cohabited_year_during = closedPredicate("cohabited_year_during", {
  a: Person,
  b: Person,
  first: Date,
  last: Date,
});
const cohabitation_since = closedPredicate("cohabitation_since", {
  a: Person,
  b: Person,
  day: Date,
});
const cohabitation_until = closedPredicate("cohabitation_until", {
  a: Person,
  b: Person,
  day: Date,
});
const has_cohabitation_since = closedPredicate("has_cohabitation_since", {
  a: Person,
  b: Person,
});
const has_cohabitation_until = closedPredicate("has_cohabitation_until", {
  a: Person,
  b: Person,
});
const cohabitation_ended_before = closedPredicate("cohabitation_ended_before", {
  a: Person,
  b: Person,
  day: Date,
});
/** A dated cohabitation covers more than half the year. */
const abode_dated_over_half = closedPredicate("abode_dated_over_half", {
  a: Person,
  b: Person,
  year: Number,
});
/** The later of a state's start and the year's first day. */
const clipped_start = closedPredicate("clipped_start", { start: Date, first: Date, day: Date });
/** The earlier of a state's end and the year's last day. */
const clipped_end = closedPredicate("clipped_end", { end: Date, last: Date, day: Date });

// --- Maintaining a home, income, returns ---

/** The person maintained a home at some time in the year. */
export const maintained_home_in = closedPredicate("maintained_home_in", {
  person: Person,
  year: Number,
});
const home_ended_before = closedPredicate("home_ended_before", { person: Person, day: Date });
const has_home_since = closedPredicate("has_home_since", { person: Person });
/**
 * The person maintains a household for the year in the sense of §2(a) and (b): over half of
 * the cost of maintaining it is furnished by the person. A stated share of half or less
 * defeats it; a home the text says the person maintained, with no share given, counts.
 */
export const maintains_household = closedPredicate("maintains_household", {
  person: Person,
  year: Number,
});
const low_cost_share = closedPredicate("low_cost_share", { person: Person });
/** The person has gross income for the year. */
export const has_income = closedPredicate("has_income", { person: Person, year: Number });
/** The person files a joint return for the year, stated with or without a year. */
export const files_jointly = closedPredicate("files_jointly", { person: Person, year: Number });
/** The person files a separate return for the year, stated with or without a year. */
export const files_separately = closedPredicate("files_separately", {
  person: Person,
  year: Number,
});

// --- Amounts and states for §1, §63, §68 and §151(d) ---

/** The person's gross income for the year: the stated amounts summed, 0 when none. */
export const gross_income_of = closedPredicate("gross_income_of", {
  person: Person,
  year: Number,
  amount: Number,
});
/** An amount of the kind the text states for the person, for the year or with no year. */
export const stated = closedPredicate("stated", {
  person: Person,
  year: Number,
  kind: AMOUNT_KINDS,
  amount: Number,
});
/** The text states some amount of the kind for the person and year. */
export const has_stated = closedPredicate("has_stated", {
  person: Person,
  year: Number,
  kind: AMOUNT_KINDS,
});
/** The stated amounts of the kind for the person and year, summed. */
export const stated_total = closedPredicate("stated_total", {
  person: Person,
  year: Number,
  kind: AMOUNT_KINDS,
  amount: Number,
});
/** The person has itemized deductions for the year, so elects to itemize. */
export const itemizes = closedPredicate("itemizes", { person: Person, year: Number });
/** The person's itemized deductions for the year before §68, 0 when none. */
export const itemized_total = closedPredicate("itemized_total", {
  person: Person,
  year: Number,
  amount: Number,
});
/** The person is blind at the close of the year. */
export const blind_at_close = closedPredicate("blind_at_close", { person: Person, year: Number });
const blind_ended_before = closedPredicate("blind_ended_before", { person: Person, day: Date });
const has_blind_since = closedPredicate("has_blind_since", { person: Person });

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
  kb.rule(has_death_date({ person: P })).iff(died({ person: P, day: D }));
  kb.rule(death_day({ person: P, day: D })).iff(
    or(
      died({ person: P, day: D }),
      and(
        passed_away.inYear({ person: P, year: Y }),
        not(has_death_date({ person: P })),
        year_bounds({ year: Y, first: F, last: L }),
        letIn(D, L, gte(D, F)),
      ),
    ),
  );
  kb.rule(marriage_ended({ a: A, b: B, end: E })).iff(
    or(
      death_day({ person: A, day: E }),
      death_day({ person: B, day: E }),
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
  kb.rule(spouse_at_close({ taxpayer: A, spouse: B, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      or(
        // The spouse died during the year: decide as of the day of death.
        and(
          death_day({ person: B, day: D }),
          gte(D, F),
          lte(D, L),
          married_at({ a: A, b: B, day: D }),
        ),
        // Otherwise as of the close of the year.
        married_at({ a: A, b: B, day: L }),
      ),
    ),
  );
  kb.rule(died_during({ person: P, first: F, last: L })).iff(
    and(death_day({ person: P, day: D }), gte(D, F), lte(D, L)),
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
  kb.rule(spouses({ a: A, b: B })).iff(marriage({ a: A, b: B, start: S }));
  kb.rule(stepparent_of({ stepparent: A, child: B })).iff(
    or(
      stepchild_of({ child: B, stepparent: A }),
      and(
        child_of({ child: B, parent: P }),
        spouses({ a: A, b: P }),
        not(child_of({ child: B, parent: A })),
      ),
    ),
  );
  kb.rule(child_incl_step({ child: A, parent: B })).iff(
    or(child_of({ child: A, parent: B }), stepparent_of({ stepparent: B, child: A })),
  );
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

  // Sharing a home.
  kb.rule(cohabited_undated({ a: A, b: B })).iff(
    or(shares_home.undated({ a: A, b: B }), shares_home.undated({ a: B, b: A })),
  );
  kb.rule(cohabited_year({ a: A, b: B, year: Y })).iff(
    or(shares_home.inYear({ a: A, b: B, year: Y }), shares_home.inYear({ a: B, b: A, year: Y })),
  );
  kb.rule(cohabitation_dated({ a: A, b: B })).iff(
    or(has_cohabitation_since({ a: A, b: B }), has_cohabitation_until({ a: A, b: B })),
  );
  kb.rule(cohabited_year_during({ a: A, b: B, first: F, last: L })).iff(
    and(
      not(cohabitation_dated({ a: A, b: B })),
      cohabited_year({ a: A, b: B, year: Y }),
      year_bounds({ year: Y, first: F2, last: L2 }),
      lte(F2, L),
      gte(L2, F),
    ),
  );
  kb.rule(cohabitation_since({ a: A, b: B, day: D })).iff(
    or(shares_home.since({ a: A, b: B, day: D }), shares_home.since({ a: B, b: A, day: D })),
  );
  kb.rule(cohabitation_until({ a: A, b: B, day: D })).iff(
    or(shares_home.until({ a: A, b: B, day: D }), shares_home.until({ a: B, b: A, day: D })),
  );
  kb.rule(has_cohabitation_since({ a: A, b: B })).iff(cohabitation_since({ a: A, b: B, day: D }));
  kb.rule(has_cohabitation_until({ a: A, b: B })).iff(cohabitation_until({ a: A, b: B, day: D }));
  kb.rule(cohabitation_ended_before({ a: A, b: B, day: D })).iff(
    and(cohabitation_until({ a: A, b: B, day: E }), gt(D, E)),
  );
  kb.rule(cohabited_during({ a: A, b: B, first: F, last: L })).iff(
    or(
      cohabited_undated({ a: A, b: B }),
      cohabited_year_during({ a: A, b: B, first: F, last: L }),
      and(
        cohabitation_since({ a: A, b: B, day: S }),
        lte(S, L),
        not(cohabitation_ended_before({ a: A, b: B, day: F })),
      ),
      and(
        cohabitation_until({ a: A, b: B, day: E }),
        gte(E, F),
        not(has_cohabitation_since({ a: A, b: B })),
      ),
    ),
  );
  kb.rule(cohabited_in({ a: A, b: B, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      cohabited_during({ a: A, b: B, first: F, last: L }),
    ),
  );
  // Over half the year: the days of the stay clipped to the year, counting both ends,
  // exceed half the year's days. A start with no end runs to the end of the year; an end
  // with no start runs from its beginning.
  kb.rule(clipped_start({ start: S, first: F, day: D })).iff(
    or(and(gte(S, F), letIn(D, S, gte(D, F))), and(gt(F, S), letIn(D, F, gte(D, F)))),
  );
  kb.rule(clipped_end({ end: E, last: L, day: D })).iff(
    or(and(lte(E, L), letIn(D, E, lte(D, L))), and(gt(E, L), letIn(D, L, lte(D, L)))),
  );
  kb.rule(abode_dated_over_half({ a: A, b: B, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      year_marks({ year: Y, julyFirst: J, halfDays: H }),
      or(
        and(
          cohabitation_since({ a: A, b: B, day: S }),
          not(has_cohabitation_until({ a: A, b: B })),
          clipped_start({ start: S, first: F, day: X }),
          gt(add(daysBetween(L, X), 1), H),
        ),
        and(
          cohabitation_until({ a: A, b: B, day: E }),
          not(has_cohabitation_since({ a: A, b: B })),
          clipped_end({ end: E, last: L, day: X }),
          gt(add(daysBetween(X, F), 1), H),
        ),
        and(
          cohabitation_since({ a: A, b: B, day: S }),
          cohabitation_until({ a: A, b: B, day: E }),
          clipped_start({ start: S, first: F, day: X }),
          clipped_end({ end: E, last: L, day: X2 }),
          gt(add(daysBetween(X2, X), 1), H),
        ),
      ),
    ),
  );
  kb.rule(abode_over_half({ a: A, b: B, year: Y })).iff(
    or(
      cohabited_undated({ a: A, b: B }),
      and(not(cohabitation_dated({ a: A, b: B })), cohabited_year({ a: A, b: B, year: Y })),
      abode_dated_over_half({ a: A, b: B, year: Y }),
    ),
  );

  // Maintaining a home, income, returns.
  kb.rule(home_ended_before({ person: P, day: D })).iff(
    and(maintains_home.until({ person: P, day: E }), gt(D, E)),
  );
  kb.rule(has_home_since({ person: P })).iff(maintains_home.since({ person: P, day: D }));
  kb.rule(maintained_home_in({ person: P, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      or(
        maintains_home.undated({ person: P }),
        maintains_home.inYear({ person: P, year: Y }),
        and(
          maintains_home.since({ person: P, day: S }),
          lte(S, L),
          not(home_ended_before({ person: P, day: F })),
        ),
        and(
          maintains_home.until({ person: P, day: E }),
          gte(E, F),
          not(has_home_since({ person: P })),
        ),
      ),
    ),
  );
  kb.rule(low_cost_share({ person: P })).iff(
    and(home_cost_share({ person: P, percent: X }), lte(X, 50)),
  );
  kb.rule(maintains_household({ person: P, year: Y })).iff(
    and(maintained_home_in({ person: P, year: Y }), not(low_cost_share({ person: P }))),
  );
  kb.rule(files_jointly({ person: P, year: Y })).iff(
    or(joint_return.undated({ person: P }), joint_return.inYear({ person: P, year: Y })),
  );
  kb.rule(files_separately({ person: P, year: Y })).iff(
    or(separate_return.undated({ person: P }), separate_return.inYear({ person: P, year: Y })),
  );

  // Amounts and blindness.
  kb.rule(stated({ person: P, year: Y, kind: K, amount: A })).iff(
    or(
      stated_amount.undated({ person: P, kind: K, amount: A }),
      stated_amount.inYear({ person: P, kind: K, amount: A, year: Y }),
    ),
  );
  kb.rule(has_stated({ person: P, year: Y, kind: K })).iff(
    stated({ person: P, year: Y, kind: K, amount: A }),
  );
  kb.rule(stated_total({ person: P, year: Y, kind: K, amount: T })).iff(
    letIn(T, sum(A).where(stated({ person: P, year: Y, kind: K, amount: A })), gte(T, 0)),
  );
  kb.rule(itemizes({ person: P, year: Y })).iff(
    has_stated({ person: P, year: Y, kind: "itemized_deduction" }),
  );
  kb.rule(itemized_total({ person: P, year: Y, amount: A })).iff(
    stated_total({ person: P, year: Y, kind: "itemized_deduction", amount: A }),
  );
  kb.rule(blind_ended_before({ person: P, day: D })).iff(
    and(blind.until({ person: P, day: E }), gt(D, E)),
  );
  kb.rule(has_blind_since({ person: P })).iff(blind.since({ person: P, day: D }));
  kb.rule(blind_at_close({ person: P, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      or(
        blind.undated({ person: P }),
        blind.inYear({ person: P, year: Y }),
        and(
          blind.since({ person: P, day: S }),
          lte(S, L),
          not(blind_ended_before({ person: P, day: L })),
        ),
        and(blind.until({ person: P, day: E }), gte(E, L), not(has_blind_since({ person: P }))),
      ),
    ),
  );
}
