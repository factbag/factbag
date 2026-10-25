import { and, closedPredicate, gte, lte, or, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const bob = new Person("bob");
const marriedOn = closedPredicate("married_on", { a: Person, b: Person, day: Date });
const died = closedPredicate("died", { person: Person, day: Date });
const marriedAt = closedPredicate("married_at", { a: Person, b: Person, day: Date });
const marriedIn = closedPredicate("married_in", { a: Person, b: Person, year: Number });
const yearEnd = closedPredicate("year_end", { year: Number, last: Date });
const A = variable("A");
const B = variable("B");
const D = variable("D");
const S = variable("S");
const Y = variable("Y");
const L = variable("L");
const end = new Date("2013-12-31T00:00:00Z");
const earlyWedding = new Date("1992-02-03T00:00:00Z");
const lateWedding = new Date("2015-02-03T00:00:00Z");
const death = new Date("2014-01-01T00:00:00Z");

const dateRule = {
  kind: "iff",
  head: { sign: "+", atom: marriedAt({ a: A, b: B, day: D }) },
  body: and(marriedOn({ a: A, b: B, day: S }), lte(S, D)),
} as const;
const yearRule = {
  kind: "iff",
  head: { sign: "+", atom: marriedIn({ a: A, b: B, year: Y }) },
  body: and(
    yearEnd({ year: Y, last: L }),
    or(
      and(died({ person: B, day: D }), gte(D, L), marriedAt({ a: A, b: B, day: D })),
      marriedAt({ a: A, b: B, day: L }),
    ),
  ),
} as const;

function scenario(wedding: Date, hasDeath: boolean) {
  return {
    build(kb: KnowledgeBase) {
      kb.entities.add(alice, bob);
      kb.asserts(marriedOn({ a: alice, b: bob, day: wedding }));
      kb.asserts(yearEnd({ year: 2013, last: end }));
      if (hasDeath) {
        kb.asserts(died({ person: bob, day: death }));
      }
      kb.rule(dateRule.head.atom).iff(dateRule.body);
      kb.rule(yearRule.head.atom).iff(yearRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        { sign: "+" as const, atom: marriedOn({ a: alice, b: bob, day: wedding }) },
        { sign: "+" as const, atom: yearEnd({ year: 2013, last: end }) },
        ...(hasDeath ? [{ sign: "+" as const, atom: died({ person: bob, day: death }) }] : []),
      ],
      rules: [dateRule, yearRule],
    },
  } as const;
}

const atom = marriedIn({ a: alice, b: bob, year: 2013 });
function proof(value: "true" | "false") {
  return ruleProof(atom, value, yearRule, [
    [A, alice],
    [B, bob],
    [Y, 2013],
  ]);
}

export const deadPathComparisonTestCases: readonly DslTestSpec[] = [
  ...[
    { name: "accepts the valid year-end alternative", wedding: earlyWedding, value: "true" },
    { name: "rejects a wedding after both comparison dates", wedding: lateWedding, value: "false" },
  ].map(({ name, wedding, value }): DslTestSpec => ({
    ...scenario(wedding, false),
    name: `dead-path comparison: ${name}`,
    invariant: "A missing event date must not crash candidate derivation on a failed branch.",
    narration:
      "No death date exists. The failed route leaves D unbound; the year-end alternative must still decide whether the wedding has happened.",
    queryAtoms: atom,
    expectedProofs: proof(value === "true" ? "true" : "false"),
  })),
  {
    ...scenario(earlyWedding, false),
    name: "dead-path comparison: enumerates the valid year without a death date",
    invariant: "Variable queries must also recover from a failed date-binding route.",
    narration:
      "The year-end fact supplies 2013; the marriage holds at that date despite no death fact.",
    queryAtoms: marriedIn({ a: alice, b: bob, year: Y }),
    expectedProofs: [proof("true")],
  },
  ...[
    { name: "accepts a wedding before a bound event date", wedding: earlyWedding, value: "true" },
    { name: "rejects a wedding after a bound event date", wedding: lateWedding, value: "false" },
  ].map(({ name, wedding, value }): DslTestSpec => ({
    ...scenario(wedding, true),
    name: `dead-path comparison control: ${name}`,
    invariant: "Live paths must continue to evaluate their date comparisons normally.",
    narration:
      "An explicit death fact binds D. Weddings before the comparison dates succeed; later weddings fail.",
    queryAtoms: atom,
    expectedProofs: proof(value === "true" ? "true" : "false"),
  })),
];
