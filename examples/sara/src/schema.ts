/**
 * The fact vocabulary Jev fills from a case's text, and the entity types its candidates
 * range over. Every fact predicate is closed: what the text does not state is false, so
 * the statute rules may use negation as failure the way the statute uses "unless".
 *
 * The schema is flat on purpose. SARA's own formalisation uses Prolog events with agents,
 * patients and start and end stamps; here each kind of event is one predicate with the
 * people and the day as fields, which is what a classifier can enumerate and judge.
 */
import { closedPredicate, enumeration } from "@factbag/core/dsl";
import type { Entity } from "@factbag/core/dsl";
import { firstDay, lastDay } from "./calendar";

/** A named individual mentioned in the text. */
export class Person implements Entity {
  constructor(readonly id: string) {}
}

const DECREES = enumeration("divorce", "separate maintenance");

const persons =
  "People are referred to by name; a day is a calendar date given as an ISO timestamp.";

function withPersons(text: string): string {
  return `${text} ${persons}`;
}

// --- Facts about people, to be filled from the text ---

export const married_on = closedPredicate(
  "married_on",
  { a: Person, b: Person, day: Date },
  {
    description:
      "Two people married each other on the given day. The order of the two spouses does " +
      "not matter.",
    instructions: withPersons(
      "ASSERT when the text says these two people got married, or married each other, on " +
        "this exact date. DENY only when the text says they married on a different date or " +
        "did not marry. IRRELEVANT when the text does not say these two married on this date. ",
    ),
  },
);

export const married_undated = closedPredicate(
  "married_undated",
  { a: Person, b: Person },
  {
    description: "Two people are married to each other, with no date given for the marriage.",
    instructions: withPersons(
      "ASSERT only when the text says these two people are, or were, married to each other " +
        "without stating when they married. If the text gives the date of the marriage, this " +
        "fact is IRRELEVANT. ",
    ),
  },
);

export const legally_separated = closedPredicate(
  "legally_separated",
  { a: Person, b: Person, decree: DECREES, day: Date },
  {
    description:
      "Two spouses were legally separated under a decree of the given kind on the given " +
      "day. The order of the two spouses does not matter.",
    instructions: withPersons(
      "ASSERT when the text says these two people were legally separated, or divorced, under " +
        "a decree of this kind on this exact date: 'divorce' for a decree of divorce, " +
        "'separate maintenance' for a decree of separate maintenance. A different kind of " +
        "decree or a different date is IRRELEVANT. ",
    ),
  },
);

export const died = closedPredicate(
  "died",
  { person: Person, day: Date },
  {
    description: "The person died on the given day.",
    instructions: withPersons(
      "ASSERT when the text says this person died on this exact date. IRRELEVANT for any " +
        "other person or date. ",
    ),
  },
);

export const born = closedPredicate(
  "born",
  { person: Person, day: Date },
  {
    description: "The person was born on the given day.",
    instructions: withPersons(
      "ASSERT when the text says this person was born on this exact date. IRRELEVANT for " +
        "any other person or date. ",
    ),
  },
);

export const nonresident_alien = closedPredicate(
  "nonresident_alien",
  { person: Person },
  {
    description:
      "The person is, or was, a nonresident alien, with no start or end date given for it.",
    instructions: withPersons(
      "ASSERT only when the text says this person is or was a nonresident alien without " +
        "saying since when or until when. If the text gives a start ('since') or end " +
        "('until') date for being a nonresident alien, this fact is IRRELEVANT. ",
    ),
  },
);

export const nonresident_alien_since = closedPredicate(
  "nonresident_alien_since",
  { person: Person, day: Date },
  {
    description: "The person has been a nonresident alien since the given day.",
    instructions: withPersons(
      "ASSERT when the text says this person was a nonresident alien since, from, or " +
        "starting on this exact date. IRRELEVANT for any other person or date, and when the " +
        "date is the end rather than the start. ",
    ),
  },
);

export const nonresident_alien_until = closedPredicate(
  "nonresident_alien_until",
  { person: Person, day: Date },
  {
    description: "The person was a nonresident alien until the given day.",
    instructions: withPersons(
      "ASSERT when the text says this person was a nonresident alien until, or up to, this " +
        "exact date. IRRELEVANT for any other person or date, and when the date is the start " +
        "rather than the end. ",
    ),
  },
);

export const child_of = closedPredicate(
  "child_of",
  { child: Person, parent: Person },
  {
    description:
      "The first person is a child (son, daughter, adopted child, or stepchild) of the " +
      "second person.",
    instructions: withPersons(
      "ASSERT when the text says the child is the parent's son, daughter, child, adopted " +
        "child, stepson or stepdaughter, or that the parent adopted the child. The fields are " +
        "ordered: 'child' must be the younger-generation person and 'parent' the older. " +
        "IRRELEVANT when the text describes the opposite direction or another relationship. ",
    ),
  },
);

export const sibling_of = closedPredicate(
  "sibling_of",
  { a: Person, b: Person },
  {
    description:
      "The two people are siblings: brother, sister, stepbrother, or stepsister of each " +
      "other. The order does not matter.",
    instructions: withPersons(
      "ASSERT when the text says one of these people is the other's brother, sister, " +
        "stepbrother or stepsister. IRRELEVANT for parent-child or other relationships. ",
    ),
  },
);

/** The predicates Jev may assert or deny from a case's text. */
export const FACT_PREDICATES = [
  married_on,
  married_undated,
  legally_separated,
  died,
  born,
  nonresident_alien,
  nonresident_alien_since,
  nonresident_alien_until,
  child_of,
  sibling_of,
] as const;

// --- The calendar, asserted as facts so rules can look up a year's bounds ---

/**
 * One row per calendar year: its first and last day, and the latest birthday of someone
 * who is still under 25 at its close, so an age test is a date comparison, not arithmetic.
 */
export const year_bounds = closedPredicate(
  "year_bounds",
  { year: BigInt, first: Date, last: Date, under25After: Date },
  { description: "Calendar bounds of a year. Fixed facts, never classified." },
);

const FIRST_YEAR = 1850;
const LAST_YEAR = 2200;

export function yearBoundsFacts(): readonly ReturnType<typeof year_bounds>[] {
  const facts: ReturnType<typeof year_bounds>[] = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year += 1) {
    facts.push(
      year_bounds({
        year: BigInt(year),
        first: firstDay(year),
        last: lastDay(year),
        under25After: lastDay(year - 25),
      }),
    );
  }
  return facts;
}
