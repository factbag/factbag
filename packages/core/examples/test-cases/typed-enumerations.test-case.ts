import {
  and,
  closedPredicate,
  daysBetween,
  enumeration,
  gte,
  letIn,
  sub,
  variable,
} from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

const year = enumeration(2017, 2018);
const recordedYear = closedPredicate("recorded_year", { year });
const recentYear = closedPredicate("recent_year", { year, previous: Number });
const Y = variable("Y");
const P = variable("P");
const yearRule = {
  kind: "iff",
  head: { sign: "+", atom: recentYear({ year: Y, previous: P }) },
  body: and(recordedYear({ year: Y }), gte(Y, 2018), letIn(P, sub(Y, 1), gte(P, 0))),
} as const;
const yearScenario = {
  build(kb: KnowledgeBase) {
    kb.asserts(recordedYear({ year: 2017 }));
    kb.asserts(recordedYear({ year: 2018 }));
    kb.rule(yearRule.head.atom).iff(yearRule.body);
  },
  expectedKnowledgeBase: {
    literals: [
      { sign: "+", atom: recordedYear({ year: 2017 }) },
      { sign: "+", atom: recordedYear({ year: 2018 }) },
    ],
    rules: [yearRule],
  },
  invariant: "Number enumeration members bind plain numbers usable in comparisons and subtraction.",
  narration:
    "Both years are recorded, but only 2018 passes the threshold and yields 2017 as its predecessor.",
} as const;

const day = enumeration(new Date("2017-01-01"), new Date("2019-12-31"));
const recordedDay = closedPredicate("recorded_day", { day });
const agedDay = closedPredicate("aged_day", { day, days: Number });
const D = variable("D");
const N = variable("N");
const dayRule = {
  kind: "iff",
  head: { sign: "+", atom: agedDay({ day: D, days: N }) },
  body: and(recordedDay({ day: D }), letIn(N, daysBetween(new Date("2020-01-01"), D), gte(N, 365))),
} as const;
const dayScenario = {
  build(kb: KnowledgeBase) {
    kb.asserts(recordedDay({ day: new Date("2017-01-01") }));
    kb.asserts(recordedDay({ day: new Date("2019-12-31") }));
    kb.rule(dayRule.head.atom).iff(dayRule.body);
  },
  expectedKnowledgeBase: {
    literals: [
      { sign: "+", atom: recordedDay({ day: new Date("2017-01-01") }) },
      { sign: "+", atom: recordedDay({ day: new Date("2019-12-31") }) },
    ],
    rules: [dayRule],
  },
  invariant:
    "Date enumeration members match by instant and bind plain dates usable in daysBetween.",
  narration:
    "Fresh date instances match the domain's instants; only January 2017 is at least a year before 2020.",
} as const;

const recent = recentYear({ year: 2018, previous: 2017 });
const old = recentYear({ year: 2017, previous: 2016 });
const aged = agedDay({ day: new Date("2017-01-01"), days: 1095 });
const young = agedDay({ day: new Date("2019-12-31"), days: 1 });

export const typedEnumerationsTestCases: readonly DslTestSpec[] = [
  {
    ...yearScenario,
    name: "typed enumerations: ground number comparison and subtraction",
    queryAtoms: recent,
    expectedProofs: ruleProof(recent, "true", yearRule, [
      [Y, 2018],
      [P, 2017],
    ]),
  },
  {
    ...yearScenario,
    name: "typed enumerations: enumerate number members and their predecessors",
    queryAtoms: recentYear({ year: Y, previous: P }),
    expectedProofs: [
      ruleProof(recent, "true", yearRule, [
        [Y, 2018],
        [P, 2017],
      ]),
    ],
  },
  {
    ...yearScenario,
    name: "typed enumerations: number member outside the compared range is false",
    queryAtoms: old,
    expectedProofs: ruleProof(old, "false", yearRule, [
      [Y, 2017],
      [P, 2016],
    ]),
  },
  {
    ...dayScenario,
    name: "typed enumerations: ground date difference with a fresh date instance",
    queryAtoms: aged,
    expectedProofs: ruleProof(aged, "true", dayRule, [
      [D, new Date("2017-01-01")],
      [N, 1095],
    ]),
  },
  {
    ...dayScenario,
    name: "typed enumerations: enumerate date members and their day counts",
    queryAtoms: agedDay({ day: D, days: N }),
    expectedProofs: [
      ruleProof(aged, "true", dayRule, [
        [D, new Date("2017-01-01")],
        [N, 1095],
      ]),
    ],
  },
  {
    ...dayScenario,
    name: "typed enumerations: date member outside the compared range is false",
    queryAtoms: young,
    expectedProofs: ruleProof(young, "false", dayRule, [
      [D, new Date("2019-12-31")],
      [N, 1],
    ]),
  },
];
