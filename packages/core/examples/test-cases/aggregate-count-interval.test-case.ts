import { and, closedPredicate, count, gte, letIn, lte, predicate, variable } from "../../src/dsl";
import type { GoalValue, QueryJudgment } from "../../src/query";
import type { AnyLiteral } from "../../src/types/literal";
import type { AnyRule } from "../../src/types/rule";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

class Friend {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const P = variable("P");
const F = variable("F");
const N = variable("N");

const friendOpen = predicate("friend_count_interval_open", { person: Person, friend: Friend });
const friendClosed = closedPredicate("friend_count_interval_closed", {
  person: Person,
  friend: Friend,
});
const unknownCandidate = closedPredicate("unknown_friend_count_interval_candidate", {
  person: Person,
  friend: Friend,
});
const unknownFriendSignal = predicate("unknown_friend_count_interval_signal", {
  person: Person,
  friend: Friend,
});
const atLeastThree = predicate("friend_count_at_least_three", { person: Person });
const atMostThree = predicate("friend_count_at_most_three", { person: Person });

type CountRuleKind = "gte" | "lte";
type CountWorld = "closed" | "open";
type EvidenceCounts = Readonly<{ definite: number; conflicted: number; unknown: number }>;

type CountCase = Readonly<{
  rule: CountRuleKind;
  world: CountWorld;
  evidence: EvidenceCounts;
  current: GoalValue;
  proposed: GoalValue;
}>;

type CountCaseHandles = Readonly<{
  literals: readonly AnyLiteral[];
  rules: readonly AnyRule[];
  rule: AnyRule;
}>;

type CountValue = number | CountRangeValue;

type CountRangeValue = Readonly<{
  kind: "numeric-range";
  lower: number;
  upper: number | "infinity";
  uncertainty: readonly CountUncertainty[];
}>;

type CountUncertainty =
  | Readonly<{ kind: "conflict"; count: number }>
  | Readonly<{ kind: "unknown"; count: number }>
  | Readonly<{ kind: "open-world" }>;

type CountedFriendPredicate = typeof friendOpen | typeof friendClosed;

const countCases: readonly CountCase[] = [
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 0, conflicted: 0, unknown: 0 },
    current: "false",
    proposed: "false",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 1, conflicted: 0, unknown: 0 },
    current: "false",
    proposed: "false",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 2, conflicted: 0, unknown: 0 },
    current: "false",
    proposed: "false",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 3, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 4, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 2, conflicted: 1, unknown: 0 },
    current: "false",
    proposed: "conflicted",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 2, conflicted: 0, unknown: 1 },
    current: "false",
    proposed: "unknown",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 2, conflicted: 1, unknown: 1 },
    current: "false",
    proposed: "conflicted",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 1, conflicted: 1, unknown: 1 },
    current: "false",
    proposed: "unknown",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 1, conflicted: 2, unknown: 0 },
    current: "false",
    proposed: "conflicted",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 1, conflicted: 0, unknown: 2 },
    current: "false",
    proposed: "unknown",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 3, conflicted: 1, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "gte",
    world: "closed",
    evidence: { definite: 3, conflicted: 0, unknown: 1 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 0, conflicted: 0, unknown: 0 },
    current: "false",
    proposed: "unknown",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 1, conflicted: 0, unknown: 0 },
    current: "false",
    proposed: "unknown",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 2, conflicted: 0, unknown: 0 },
    current: "false",
    proposed: "unknown",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 3, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 4, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 2, conflicted: 1, unknown: 0 },
    current: "false",
    proposed: "conflicted",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 2, conflicted: 0, unknown: 1 },
    current: "false",
    proposed: "unknown",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 2, conflicted: 1, unknown: 1 },
    current: "false",
    proposed: "conflicted",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 1, conflicted: 1, unknown: 1 },
    current: "false",
    proposed: "unknown",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 1, conflicted: 2, unknown: 0 },
    current: "false",
    proposed: "conflicted",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 1, conflicted: 0, unknown: 2 },
    current: "false",
    proposed: "unknown",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 3, conflicted: 1, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "gte",
    world: "open",
    evidence: { definite: 3, conflicted: 0, unknown: 1 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 0, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 1, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 2, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 3, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 4, conflicted: 0, unknown: 0 },
    current: "false",
    proposed: "false",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 2, conflicted: 1, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 2, conflicted: 0, unknown: 1 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 2, conflicted: 1, unknown: 1 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 3, conflicted: 1, unknown: 0 },
    current: "true",
    proposed: "conflicted",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 3, conflicted: 0, unknown: 1 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 3, conflicted: 1, unknown: 1 },
    current: "true",
    proposed: "conflicted",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 1, conflicted: 1, unknown: 1 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 1, conflicted: 2, unknown: 0 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "lte",
    world: "closed",
    evidence: { definite: 1, conflicted: 0, unknown: 2 },
    current: "true",
    proposed: "true",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 0, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 1, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 2, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 3, conflicted: 0, unknown: 0 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 4, conflicted: 0, unknown: 0 },
    current: "false",
    proposed: "false",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 2, conflicted: 1, unknown: 0 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 2, conflicted: 0, unknown: 1 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 2, conflicted: 1, unknown: 1 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 3, conflicted: 1, unknown: 0 },
    current: "true",
    proposed: "conflicted",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 3, conflicted: 0, unknown: 1 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 3, conflicted: 1, unknown: 1 },
    current: "true",
    proposed: "conflicted",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 1, conflicted: 1, unknown: 1 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 1, conflicted: 2, unknown: 0 },
    current: "true",
    proposed: "unknown",
  },
  {
    rule: "lte",
    world: "open",
    evidence: { definite: 1, conflicted: 0, unknown: 2 },
    current: "true",
    proposed: "unknown",
  },
];

export const aggregateCountIntervalTestCases: readonly DslTestSpec[] = countCases.map(
  (testCase): DslTestSpec => {
    const countedFriend = testCase.world === "closed" ? friendClosed : friendOpen;
    const head = testCase.rule === "gte" ? atLeastThree : atMostThree;
    const comparison = testCase.rule === "gte" ? gte(N, 3) : lte(N, 3);

    return {
      name: `DOD: count interval ${testCase.rule}(count, 3) ${testCase.world} ${evidenceLabel(testCase.evidence)}`,
      invariant:
        "Count aggregates should evaluate threshold predicates over an interval formed from definite, conflicted, unknown, and open-world candidate rows.",
      narration: `The current count implementation returns ${testCase.current}; proposed interval count semantics return ${testCase.proposed}.`,
      queryAtoms: head({ person: alice }),
      build(kb) {
        const literals: AnyLiteral[] = [];
        const rules: AnyRule[] = [];
        const friends = friendsFor(testCase.evidence);

        for (const friend of friends.definite) {
          kb.asserts(countedFriend({ person: alice, friend }), { source: "definite_friend" });
          literals.push({
            sign: "+",
            atom: countedFriend({ person: alice, friend }),
            metadata: { source: "definite_friend" },
          });
        }

        for (const friend of friends.conflicted) {
          kb.asserts(countedFriend({ person: alice, friend }), { source: "conflicting_positive" });
          kb.denies(countedFriend({ person: alice, friend }), { source: "conflicting_negative" });
          literals.push(
            {
              sign: "+",
              atom: countedFriend({ person: alice, friend }),
              metadata: { source: "conflicting_positive" },
            },
            {
              sign: "-",
              atom: countedFriend({ person: alice, friend }),
              metadata: { source: "conflicting_negative" },
            },
          );
        }

        if (friends.unknown.length > 0) {
          const unknownRule = kb
            .rule(countedFriend({ person: P, friend: F }))
            .if(
              and(
                unknownCandidate({ person: P, friend: F }),
                unknownFriendSignal({ person: P, friend: F }),
              ),
            );
          rules.push(unknownRule);

          for (const friend of friends.unknown) {
            kb.asserts(unknownCandidate({ person: alice, friend }), {
              source: "unknown_candidate",
            });
            literals.push({
              sign: "+",
              atom: unknownCandidate({ person: alice, friend }),
              metadata: { source: "unknown_candidate" },
            });
          }
        }

        const rule = kb
          .rule(head({ person: P }))
          .iff(letIn(N, count(F).where(countedFriend({ person: P, friend: F })), comparison));
        rules.push(rule);

        return { literals, rules, rule };
      },
      expected(handles) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes this callback the exact value returned by build above.
        const { literals, rules, rule } = handles as CountCaseHandles;
        return {
          expectedKnowledgeBase: { literals, rules },
          expectedProofs: expectedCountProof(testCase, rule, countedFriend),
        };
      },
    };
  },
);

function expectedCountProof(
  testCase: CountCase,
  rule: AnyRule,
  countedFriend: CountedFriendPredicate,
): QueryJudgment {
  const head = testCase.rule === "gte" ? atLeastThree : atMostThree;
  const comparisonGoal = { kind: testCase.rule, left: N, right: 3 } as const;
  const countGoal = {
    kind: "count",
    bind: N,
    where: expectedWhereGoal(testCase, countedFriend),
  } as const;
  const bodyGoal = { kind: "and", goals: [countGoal, comparisonGoal] } as const;
  const countValue = countResult(testCase);
  const bindings = [
    [P, alice],
    [N, countValue],
  ] as const;
  const body = {
    value: testCase.proposed,
    goal: bodyGoal,
    bindings,
    ...supportFor(testCase.proposed, {
      source: "subgoals" as const,
      judgments: [
        countJudgment(testCase, countGoal, countValue, bindings),
        comparisonJudgment(testCase, comparisonGoal, countValue, bindings),
      ],
    }),
  };
  const ruleSupport = { source: "rule" as const, rule, body };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- supportFor constructs the discriminated support member selected by the proposed goal value.
  return {
    value: testCase.proposed,
    goal: { kind: "atom", atom: head({ person: alice }) },
    bindings: [],
    ...supportFor(testCase.proposed, ruleSupport),
  } as QueryJudgment;
}

function countJudgment(
  testCase: CountCase,
  countGoal: Readonly<{
    kind: "count";
    bind: typeof N;
    where: ReturnType<typeof expectedWhereGoal>;
  }>,
  countValue: CountValue,
  bindings: readonly (readonly [unknown, unknown])[],
) {
  return {
    value: "true" as const,
    goal: countGoal,
    bindings,
    positive: [
      {
        source: "primitive" as const,
        evaluation: {
          operation: "count",
          operands: [],
          value: "true" as const,
          result: countValue,
          results: [[N, countValue]],
          range: countRange(testCase),
          ...(countUncertainty(testCase).length === 0
            ? {}
            : { uncertainty: countUncertainty(testCase) }),
        },
      },
    ],
  };
}

function comparisonJudgment(
  testCase: CountCase,
  comparisonGoal: Readonly<{ kind: CountRuleKind; left: typeof N; right: 3 }>,
  countValue: CountValue,
  bindings: readonly (readonly [unknown, unknown])[],
) {
  return {
    value: testCase.proposed,
    goal: comparisonGoal,
    bindings,
    ...supportFor(testCase.proposed, {
      source: "primitive" as const,
      evaluation: {
        operation: testCase.rule,
        operands: [countValue, 3],
        value: testCase.proposed,
        ...(isCountRangeValue(countValue) ? { range: countRange(testCase) } : {}),
        ...(comparisonUncertainty(testCase).length === 0
          ? {}
          : { uncertainty: comparisonUncertainty(testCase) }),
      },
    }),
  };
}

function supportFor(value: GoalValue, support: unknown) {
  switch (value) {
    case "true":
      return { positive: [support] };
    case "false":
      return { negative: [support] };
    case "unknown":
      return { inconclusive: [support] };
    case "conflicted":
      return { positive: [support], negative: [support] };
    default:
      throw new Error("Unhandled goal value");
  }
}

function countResult(testCase: CountCase): CountValue {
  const range = countRange(testCase);
  const uncertainty = countUncertainty(testCase);

  if (uncertainty.length === 0 && range.upper !== "infinity" && range.lower === range.upper) {
    return range.lower;
  }

  return { kind: "numeric-range", ...range, uncertainty };
}

function countRange(testCase: CountCase): Readonly<{ lower: number; upper: number | "infinity" }> {
  return {
    lower: testCase.evidence.definite,
    upper:
      testCase.world === "open"
        ? "infinity"
        : testCase.evidence.definite + testCase.evidence.conflicted + testCase.evidence.unknown,
  };
}

function countUncertainty(testCase: CountCase): readonly CountUncertainty[] {
  const uncertainty: CountUncertainty[] = [];
  if (testCase.evidence.conflicted > 0) {
    uncertainty.push({ kind: "conflict", count: testCase.evidence.conflicted });
  }
  if (testCase.evidence.unknown > 0) {
    uncertainty.push({ kind: "unknown", count: testCase.evidence.unknown });
  }
  if (testCase.world === "open") {
    uncertainty.push({ kind: "open-world" });
  }
  return uncertainty;
}

function comparisonUncertainty(testCase: CountCase): readonly CountUncertainty[] {
  if (testCase.proposed === "true" || testCase.proposed === "false") {
    return [];
  }

  const uncertainty = countUncertainty(testCase);
  if (testCase.proposed === "conflicted") {
    return uncertainty.filter((item) => item.kind === "conflict");
  }

  return uncertainty.filter((item) => item.kind !== "conflict");
}

function isCountRangeValue(value: CountValue): value is CountRangeValue {
  return typeof value === "object" && "kind" in value;
}

function expectedWhereGoal(testCase: CountCase, countedFriend: CountedFriendPredicate) {
  const friends = friendsFor(testCase.evidence);
  const goals = [...friends.definite, ...friends.conflicted, ...friends.unknown].map((friend) => ({
    kind: "atom" as const,
    atom: countedFriend({ person: alice, friend }),
  }));

  if (goals.length === 1) {
    const goal = goals[0];
    if (goal === undefined) {
      throw new Error("Expected one aggregate where goal");
    }
    return goal;
  }

  return { kind: "or" as const, goals };
}

function evidenceLabel(evidence: EvidenceCounts): string {
  const parts = [
    evidence.definite === 0 ? undefined : `${evidence.definite}d`,
    evidence.conflicted === 0 ? undefined : `${evidence.conflicted}c`,
    evidence.unknown === 0 ? undefined : `${evidence.unknown}u`,
  ].filter((part): part is string => part !== undefined);

  return parts.length === 0 ? "0d" : parts.join("+");
}

function friendsFor(evidence: EvidenceCounts): Readonly<{
  definite: readonly Friend[];
  conflicted: readonly Friend[];
  unknown: readonly Friend[];
}> {
  return {
    definite: makeFriends("d", evidence.definite),
    conflicted: makeFriends("c", evidence.conflicted),
    unknown: makeFriends("u", evidence.unknown),
  };
}

function makeFriends(prefix: string, countValue: number): readonly Friend[] {
  return Array.from({ length: countValue }, (_, index) => new Friend(`${prefix}${index + 1}`));
}
