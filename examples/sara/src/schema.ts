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
import type { ClosedWorldPredicate, Entity, PredicateSchema } from "@factbag/core/dsl";
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
        "this exact date, or have been married since this exact date. DENY only when the text " +
        "says they married on a different date or did not marry. IRRELEVANT when the text does " +
        "not say these two married on this date. ",
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
      "The first person is a child (son, daughter, or adopted child) of the second person, " +
      "who is their father or mother. Step relations are a separate fact.",
    instructions: withPersons(
      "ASSERT when the text says the child is the parent's son, daughter or child, that the " +
        "parent is the child's father or mother, or that the parent adopted the child. When " +
        "the text says two people have a child, son or daughter together, the child is a " +
        "child of each of them: ASSERT for both parents. The fields are ordered: 'child' must " +
        "be the younger-generation person and 'parent' the older. IRRELEVANT for a stepson, " +
        "stepdaughter, stepfather or stepmother, for the opposite direction, and for any " +
        "other relationship. ",
    ),
  },
);

export const stepchild_of = closedPredicate(
  "stepchild_of",
  { child: Person, stepparent: Person },
  {
    description:
      "The first person is a stepson or stepdaughter of the second, who is their stepfather " +
      "or stepmother.",
    instructions: withPersons(
      "ASSERT when the text says the child is the stepparent's stepson or stepdaughter, or " +
        "that the stepparent is the child's stepfather or stepmother. The fields are ordered: " +
        "'child' is the younger-generation person, 'stepparent' the older. IRRELEVANT for a " +
        "son, daughter, father or mother by blood or adoption, for the opposite direction, " +
        "and for any other relationship. ",
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

// --- States that hold over time ---
//
// A legal status is given per taxable year ("for the years 2017 to 2019"), so it is one
// fact per year, plus an undated form for a status stated with no year. A physical state
// may be given to the day ("since September 16th, 2017") or by year ("from 2004 to 2019"),
// so it has a start and an end over the days the text writes out, a per-year form, and an
// undated form.

type StateFields = Readonly<Record<string, typeof Person | PredicateSchema[string]>>;

export type Yearly<Fields extends StateFields> = Readonly<{
  /** The status holds, with no year given. */
  undated: ClosedWorldPredicate<Fields>;
  /** The status holds for the given calendar year. */
  inYear: ClosedWorldPredicate<Fields & { year: BigIntConstructor }>;
}>;

export type Dated<Fields extends StateFields> = Yearly<Fields> &
  Readonly<{
    /** The state began on the day. */
    since: ClosedWorldPredicate<Fields & { day: DateConstructor }>;
    /** The state ended on the day. */
    until: ClosedWorldPredicate<Fields & { day: DateConstructor }>;
  }>;

const YEARS =
  "The year is a four-digit number. A statement for a range of years, such as 'from 2004 " +
  "to 2019' or 'for the years 2017 to 2019', holds for every year in the range.";

/**
 * Two closed predicates for one legal status: `name` when the text gives no year, and
 * `name_in` per year. `holds` is the status as a clause about the named fields.
 */
function yearly<const Fields extends StateFields>(
  name: string,
  fields: Fields,
  holds: string,
  notes = "",
): Yearly<Fields> {
  return {
    undated: closedPredicate(name, fields, {
      description: `${holds}, with no year or period given for it.`,
      instructions: withPersons(
        `ASSERT only when the text says that ${holds} without saying for which year or ` +
          `years. If the text gives a year, a range of years, or dates for it, this fact is ` +
          `IRRELEVANT. DENY when the text says the opposite. ${notes}`,
      ),
    }),
    inYear: closedPredicate(
      `${name}_in`,
      { ...fields, year: BigInt },
      {
        description: `${holds}, for the given calendar year.`,
        instructions: withPersons(
          `ASSERT when the text says that ${holds} in, during, or for this year, or for a ` +
            `range of years that includes it. IRRELEVANT for a year the text does not cover, ` +
            `and when the text gives no year at all. DENY when the text says the opposite for ` +
            `this year. ${YEARS} ${notes}`,
        ),
      },
    ),
  };
}

/**
 * Four closed predicates for one physical state: the two of {@link yearly}, and
 * `name_since` and `name_until` for the exact days it began and ended.
 */
function dated<const Fields extends StateFields>(
  name: string,
  fields: Fields,
  holds: string,
  notes = "",
): Dated<Fields> {
  return {
    ...yearly(
      name,
      fields,
      holds,
      `${notes} If the text gives the exact day the state began or ended, the dated facts ` +
        `carry it and the per-year fact is IRRELEVANT.`,
    ),
    since: closedPredicate(
      `${name}_since`,
      { ...fields, day: Date },
      {
        description: `${holds}, beginning on the given day.`,
        instructions: withPersons(
          `ASSERT when the text says that ${holds} starting on, since, or from this exact ` +
            `day: the first day of the state. IRRELEVANT for any other day, including the day ` +
            `the state ended and days within it, and when the text gives the start as a year ` +
            `rather than a day. ${notes}`,
        ),
      },
    ),
    until: closedPredicate(
      `${name}_until`,
      { ...fields, day: Date },
      {
        description: `${holds}, ending on the given day.`,
        instructions: withPersons(
          `ASSERT when the text says that ${holds} until, or ending on, this exact day: the ` +
            `last day of the state. IRRELEVANT for any other day, including the day the state ` +
            `began and days within it, and when the text gives the end as a year rather than ` +
            `a day. ${notes}`,
        ),
      },
    ),
  };
}

export const shares_home = dated(
  "shares_home",
  { a: Person, b: Person },
  "the two people lived in the same home, house or household, or had the same principal " +
    "place of abode",
  "The order of the two people does not matter. Only people the text itself places in " +
    "the same home count: a spouse, parent or child the text does not put there, or who " +
    "had died or lived elsewhere, is IRRELEVANT.",
);

export const maintains_home = dated(
  "maintains_home",
  { person: Person },
  "the person maintained a home, or furnished the cost of maintaining a household",
  "It does not matter what share of the cost the person furnished. Only the person the " +
    "text says maintained the home or furnished its cost counts; the others who lived " +
    "there did not maintain it.",
);

export const home_cost_share = closedPredicate(
  "home_cost_share",
  { person: Person, percent: Number },
  {
    description:
      "The share, as a percentage, of the cost of maintaining the household that the person " +
      "furnished.",
    instructions: withPersons(
      "ASSERT when the text says this person furnished exactly this percentage of the cost of " +
        "maintaining the home. IRRELEVANT when the text gives no percentage, or a different " +
        "one. A dollar amount is not a percentage. ",
    ),
  },
);

const STATED_ONLY =
  "Only what the text states, naming this section, counts: do not infer this status from a " +
  "family relationship, from a deduction, or from another section the text cites.";

export const deduction_151c = yearly(
  "deduction_151c",
  { taxpayer: Person, dependent: Person },
  "the taxpayer is entitled to a deduction for the dependent under section 151(c)",
  "The fields are ordered: 'taxpayer' takes the deduction, 'dependent' is the person it is " +
    `for. A statement that the taxpayer is not entitled to such a deduction is a DENY. ${STATED_ONLY}`,
);

export const exemption_151b = yearly(
  "exemption_151b",
  { taxpayer: Person, spouse: Person },
  "the taxpayer is allowed an exemption for the spouse under section 151(b)",
  "The fields are ordered: 'taxpayer' takes the exemption, 'spouse' is the person it is for. " +
    `A statement that the taxpayer is not entitled to it is a DENY. ${STATED_ONLY}`,
);

export const qualifying_child_152c = yearly(
  "qualifying_child_152c",
  { child: Person, taxpayer: Person },
  "the text says the child is a qualifying child of the taxpayer under section 152(c), or " +
    "satisfies section 152(c)(1) with respect to the taxpayer",
  "The fields are ordered: 'child' is the qualifying child, 'taxpayer' the person they " +
    "qualify for; when the text names no taxpayer, it is the parent or relative the child is " +
    `introduced through. ${STATED_ONLY} In particular, a text saying only that someone ` +
    "satisfies section 152(c)(2) or 152(c)(3), or is someone's son or daughter, does not say " +
    "they are a qualifying child: that is IRRELEVANT here.",
);

export const dependent_152 = yearly(
  "dependent_152",
  { dependent: Person, taxpayer: Person },
  "the text says the dependent is a dependent of the taxpayer under section 152, whichever " +
    "subsection it cites",
  "The fields are ordered: 'dependent' is the dependent, 'taxpayer' the person they depend " +
    `on. A statement that someone is not a dependent is a DENY. ${STATED_ONLY} In particular, ` +
    "a deduction under section 151(c), a qualifying-child statement, or satisfying 152(c)(2) " +
    "or 152(c)(3) does not say the person is a dependent: that is IRRELEVANT here.",
);

export const satisfies_152c2 = yearly(
  "satisfies_152c2",
  { child: Person, taxpayer: Person },
  "the child satisfies section 152(c)(2), or bears a relationship to the taxpayer under " +
    "section 152(c)(2), with the taxpayer as the taxpayer",
  "The fields are ordered: 'child' is the person who satisfies the subsection, 'taxpayer' " +
    `the taxpayer it is satisfied for. ${STATED_ONLY}`,
);

export const satisfies_152c3 = yearly(
  "satisfies_152c3",
  { child: Person, taxpayer: Person },
  "the child satisfies section 152(c)(3) with the taxpayer as the taxpayer",
  "The fields are ordered: 'child' is the person who satisfies the subsection, 'taxpayer' " +
    `the taxpayer it is satisfied for. ${STATED_ONLY}`,
);

export const joint_return = yearly(
  "joint_return",
  { person: Person },
  "the person files, or filed, a joint return with their spouse, or files jointly",
  "The spouse may be named or not. When the text says two people file a joint return " +
    "together, this holds for each of them. Filing separately is the opposite: DENY.",
);

export const separate_return = yearly(
  "separate_return",
  { person: Person },
  "the person files, or filed, a separate return",
  "When the text says two people file separate returns, this holds for each of them.",
);

export const married_stated = yearly(
  "married_stated",
  { person: Person },
  "the person is married, as the text states it, naming section 7703 or no spouse",
  "This is for a marital status the text states outright, such as 'is married under " +
    "section 7703 for the year' or 'has been married since' a date with no spouse named. " +
    "When the text names the spouse and the wedding day, the marriage facts carry it and this " +
    "is IRRELEVANT. 'Is not married' is a DENY.",
);

export const surviving_spouse_stated = yearly(
  "surviving_spouse_stated",
  { person: Person },
  "the text says the person is a surviving spouse",
  "Only an outright statement counts, such as 'is a surviving spouse for the year'; do not " +
    "infer it from a death. 'Is not a surviving spouse' is a DENY.",
);

export const head_of_household_stated = yearly(
  "head_of_household_stated",
  { person: Person },
  "the text says the person is a head of household",
  "Only an outright statement counts; do not infer it from who lives where. 'Is not a head " +
    "of household' is a DENY.",
);

export const employed = dated(
  "employed",
  { employer: Person, employee: Person },
  "the employer employed the employee, or the employee worked for the employer",
  "The fields are ordered: 'employer' pays for the work, 'employee' does it. A list of " +
    "single days worked is not a period; leave those IRRELEVANT here.",
);

export const employed_on = closedPredicate(
  "employed_on",
  { employer: Person, employee: Person, day: Date },
  {
    description: "The employer employed the employee on the given single day.",
    instructions: withPersons(
      "ASSERT when the text lists this exact day as an occasion on which the employer " +
        "employed the employee. The text may list the people by initial letter: an initial " +
        "stands for the one named person whose name starts with it. The fields are ordered: " +
        "'employer' is the one person the text says did the employing; 'employee' is one of " +
        "the people employed. Two employees never employ each other. IRRELEVANT for a day " +
        "the employee is not listed on, and for employment given as a period rather than " +
        "single days. ",
    ),
  },
);

export const agricultural_labor = closedPredicate(
  "agricultural_labor",
  { employer: Person, employee: Person },
  {
    description: "The work the employee did for the employer was agricultural labor.",
    instructions: withPersons(
      "ASSERT when the text says the employer employed, or paid, the employee for " +
        "agricultural labor. The fields are ordered: 'employer' pays for the work, " +
        "'employee' does it. IRRELEVANT for any other kind of work or service. ",
    ),
  },
);

export const paid = closedPredicate(
  "paid",
  { payer: Person, payee: Person, amount: Number },
  {
    description: "The payer paid the payee this amount in dollars, as wages or otherwise.",
    instructions: withPersons(
      "ASSERT when the text says the payer paid, or paid wages of, exactly this dollar amount " +
        "to the payee. When the text pairs several amounts with several people " +
        "'respectively', match each amount to the person in the same position. The fields " +
        "are ordered: 'payer' pays, 'payee' receives. IRRELEVANT for a different amount, " +
        "for money paid into a fund or insurance rather than to the person, and for income " +
        "the text does not attribute to a named payer. ",
    ),
  },
);

export const gross_income = closedPredicate(
  "gross_income",
  { person: Person, year: BigInt, amount: Number },
  {
    description: "The person's gross income, earnings or pay for the given calendar year.",
    instructions: withPersons(
      "ASSERT when the text says this person's gross income for this year was exactly this " +
        "amount, or that the person earned or was paid exactly this amount in this year. A " +
        "statement that someone earned an amount every year over a range of years holds for " +
        "each year in the range. IRRELEVANT for a different year or amount, and for amounts " +
        "the person paid out. The year is a four-digit number. ",
    ),
  },
);

export const disabled = dated(
  "disabled",
  { person: Person },
  "the person is, or was, disabled",
  "A diagnosis of disability on a day starts the state on that day.",
);

export const retired = dated(
  "retired",
  { person: Person },
  "the person is, or was, retired",
  "Retiring on a day, or in a year, starts the state then.",
);

export const has_disability_plan = closedPredicate(
  "has_disability_plan",
  { employer: Person },
  {
    description:
      "The employer has a plan, set up for their employees, that provides for disability.",
    instructions: withPersons(
      "ASSERT when the text says this person has, or set up, a disability plan for their " +
        "employees. DENY when the text says this person had no such plan. IRRELEVANT when the " +
        "text does not mention a plan. ",
    ),
  },
);

function yearlyPredicates<Fields extends StateFields>(
  state: Yearly<Fields>,
): readonly [Yearly<Fields>["undated"], Yearly<Fields>["inYear"]] {
  return [state.undated, state.inYear];
}

function datedPredicates<Fields extends StateFields>(
  state: Dated<Fields>,
): readonly [
  Dated<Fields>["undated"],
  Dated<Fields>["inYear"],
  Dated<Fields>["since"],
  Dated<Fields>["until"],
] {
  return [state.undated, state.inYear, state.since, state.until];
}

// --- Amounts the text states, for §1, §63, §68 and §151(d) ---

export const taxable_income = closedPredicate(
  "taxable_income",
  { person: Person, year: BigInt, amount: Number },
  {
    description: "The person's taxable income for the given calendar year, as the text states it.",
    instructions: withPersons(
      "ASSERT when the text says this person's taxable income for this year is exactly this " +
        "amount. A taxable income the text gives for the person and their spouse together is " +
        "this person's. IRRELEVANT for gross income, pay, earnings or income that the text does " +
        "not call taxable income, and for a different year or amount. The year is a four-digit " +
        "number. ",
    ),
  },
);

/** The kinds of amount a text states by naming the section that allows it. */
export const AMOUNT_KINDS = enumeration(
  "exemption_151",
  "exemption_151c",
  "exemption_amount_151d",
  "standard_deduction_63c",
  "basic_standard_deduction_63c2",
  "additional_standard_deduction_63c3",
  "itemized_deduction",
  "applicable_amount_68b",
);

export const stated_amount = yearly(
  "stated_amount",
  { person: Person, kind: AMOUNT_KINDS, amount: Number },
  "the person is allowed, entitled to, gets, or has an amount of the given kind",
  "The kinds: 'exemption_151' is a deduction or exemption the person is allowed under " +
    "section 151 or 151(a), or under 151(b) for themself, as a total; 'exemption_151c' is an " +
    "exemption or deduction under section 151(c) for a dependent; 'exemption_amount_151d' is " +
    "the exemption amount under section 151(d); 'standard_deduction_63c' is a deduction under " +
    "section 63(c), the standard deduction; 'basic_standard_deduction_63c2' is the basic " +
    "standard deduction under section 63(c)(2); 'additional_standard_deduction_63c3' is the " +
    "additional standard deduction under section 63(c)(3) as a total; 'itemized_deduction' is " +
    "an itemized deduction, a deduction under section 63 or 63(d), or a deduction for a gift " +
    "to charity; 'applicable_amount_68b' is the applicable amount under section 68(b). An " +
    "amount of one kind is IRRELEVANT to every other kind. Income, pay, taxable income, taxes " +
    "paid and additional amounts under section 63(f) are not amounts of these kinds.",
);

export const additional_amount_63f = yearly(
  "additional_amount_63f",
  { taxpayer: Person, beneficiary: Person, amount: Number },
  "the taxpayer is entitled to an additional standard deduction, or additional amount, of " +
    "this amount under section 63(f) on account of the beneficiary",
  "The fields are ordered: 'taxpayer' is entitled to the amount, 'beneficiary' is the person it " +
    "is for, who is the taxpayer themself under section 63(f)(1)(A) or 63(f)(2)(A) and the " +
    "taxpayer's spouse under 63(f)(1)(B) or 63(f)(2)(B). When the text gives one amount 'each' " +
    "for several people, it holds for each of them.",
);

export const blind = dated(
  "blind",
  { person: Person },
  "the person is, or was, blind",
  "Becoming blind on a day, or having been blind since a day, starts the state on that day.",
);

/**
 * Names the fact vocabulary and its instructions, so a results file says which extraction
 * produced it. Bump it when a predicate or instruction changes. "probe-4-2026-10-22" was
 * the first frozen baseline; "d2-2026-10-22" split step relations out of child_of for
 * §152(d)(2); "hh-2026-10-23" made the joint return a one-person fact and added the stated
 * marital, surviving-spouse and head-of-household statuses for the household provisions.
 */
export const EXTRACTION_VERSION = "am-2026-10-23";

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
  stepchild_of,
  sibling_of,
  ...datedPredicates(shares_home),
  ...datedPredicates(maintains_home),
  home_cost_share,
  ...yearlyPredicates(deduction_151c),
  ...yearlyPredicates(exemption_151b),
  ...yearlyPredicates(qualifying_child_152c),
  ...yearlyPredicates(dependent_152),
  ...yearlyPredicates(satisfies_152c2),
  ...yearlyPredicates(satisfies_152c3),
  ...yearlyPredicates(joint_return),
  ...yearlyPredicates(separate_return),
  ...yearlyPredicates(married_stated),
  ...yearlyPredicates(surviving_spouse_stated),
  ...yearlyPredicates(head_of_household_stated),
  ...datedPredicates(employed),
  employed_on,
  agricultural_labor,
  paid,
  gross_income,
  ...datedPredicates(disabled),
  ...datedPredicates(retired),
  has_disability_plan,
  taxable_income,
  ...yearlyPredicates(stated_amount),
  ...yearlyPredicates(additional_amount_63f),
  ...datedPredicates(blind),
] as const;

// --- The calendar, asserted as facts so rules can look up a year's bounds ---

/** One row per calendar year: its first and last day. */
export const year_bounds = closedPredicate(
  "year_bounds",
  { year: BigInt, first: Date, last: Date },
  { description: "Calendar bounds of a year. Fixed facts, never classified." },
);

/**
 * One row per calendar year for the "more than one-half of the year" and "last 6 months"
 * tests: the first of July, and half the year's length in whole days, rounded down, so
 * that a state covering more days than that covers more than half the year.
 */
export const year_marks = closedPredicate(
  "year_marks",
  { year: BigInt, julyFirst: Date, halfDays: Number },
  { description: "Calendar marks of a year. Fixed facts, never classified." },
);

const DAY_MS = 86_400_000;

const FIRST_YEAR = 1900;
const LAST_YEAR = 2100;

export function yearBoundsFacts(): readonly ReturnType<typeof year_bounds>[] {
  const facts: ReturnType<typeof year_bounds>[] = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year += 1) {
    facts.push(
      year_bounds({
        year: BigInt(year),
        first: firstDay(year),
        last: lastDay(year),
      }),
    );
  }
  return facts;
}

export function yearMarksFacts(): readonly ReturnType<typeof year_marks>[] {
  const facts: ReturnType<typeof year_marks>[] = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year += 1) {
    const days = Math.round((lastDay(year).getTime() - firstDay(year).getTime()) / DAY_MS) + 1;
    facts.push(
      year_marks({
        year: BigInt(year),
        julyFirst: new Date(Date.UTC(year, 6, 1)),
        halfDays: Math.floor(days / 2),
      }),
    );
  }
  return facts;
}
