import { closedPredicate, not, predicate } from "../../src/dsl";
import { Person, alice } from "../scenarios/common";
import { P } from "../scenarios/vars";
import type { DslTestSpec } from "../test-runner/test-runner";

const bob = new Person("bob");
const cara = new Person("cara");
const drew = new Person("drew");

const activeSanction = closedPredicate("active_sanction", { person: Person });
const eligible = predicate("eligible", { person: Person });
const sanctionsRegistry = { source: "sanctions_registry" } as const;
const appealsBoard = { source: "appeals_board" } as const;

const eligibilityRule = {
  head: { sign: "+", atom: eligible({ person: P }) },
  kind: "iff",
  body: not(activeSanction({ person: P })),
} as const;

export const closedWorldNegationTestCase: DslTestSpec = {
  name: "closed-world not: complete goal-value table",
  invariant:
    "For a closed-world predicate, `not(atom)` uses negation-as-failure: unknown becomes true, false becomes true, true becomes false, and conflicted remains conflicted.",
  narration:
    "Eligibility is defined as the absence of an active sanction. Because activeSanction is closed-world, missing sanction evidence is enough to derive eligibility, accepted positive sanction evidence makes eligibility false, accepted negative sanction evidence makes eligibility true, and conflicting sanction evidence keeps eligibility conflicted.",
  build(kb) {
    kb.asserts(activeSanction({ person: bob }), {
      source: "sanctions_registry",
    });
    kb.denies(activeSanction({ person: cara }), {
      source: "sanctions_registry",
    });
    kb.asserts(activeSanction({ person: drew }), {
      source: "sanctions_registry",
    });
    kb.denies(activeSanction({ person: drew }), { source: "appeals_board" });
    kb.rule(eligible({ person: P })).iff(eligibilityRule.body);
  },
  expectedKnowledgeBase: {
    literals: [
      {
        sign: "+",
        atom: activeSanction({ person: bob }),
        metadata: sanctionsRegistry,
      },
      {
        sign: "-",
        atom: activeSanction({ person: cara }),
        metadata: sanctionsRegistry,
      },
      {
        sign: "+",
        atom: activeSanction({ person: drew }),
        metadata: sanctionsRegistry,
      },
      {
        sign: "-",
        atom: activeSanction({ person: drew }),
        metadata: appealsBoard,
      },
    ],
    rules: [eligibilityRule],
  },
  queryAtoms: [
    eligible({ person: alice }),
    eligible({ person: bob }),
    eligible({ person: cara }),
    eligible({ person: drew }),
  ],
  expectedProofs: [
    {
      value: "true",
      goal: { kind: "atom", atom: eligible({ person: alice }) },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: eligibilityRule,
          body: {
            value: "true",
            goal: {
              kind: "not",
              goal: { kind: "atom", atom: activeSanction({ person: alice }) },
            },
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "false",
                    goal: {
                      kind: "atom",
                      atom: activeSanction({ person: alice }),
                    },
                    bindings: [[P, alice]],
                    negative: [{ source: "closed-world-absence" }],
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      value: "false",
      goal: { kind: "atom", atom: eligible({ person: bob }) },
      bindings: [],
      negative: [
        {
          source: "rule",
          rule: eligibilityRule,
          body: {
            value: "false",
            goal: {
              kind: "not",
              goal: { kind: "atom", atom: activeSanction({ person: bob }) },
            },
            bindings: [[P, bob]],
            negative: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "true",
                    goal: {
                      kind: "atom",
                      atom: activeSanction({ person: bob }),
                    },
                    bindings: [[P, bob]],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: activeSanction({ person: bob }),
                            metadata: sanctionsRegistry,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      value: "true",
      goal: { kind: "atom", atom: eligible({ person: cara }) },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: eligibilityRule,
          body: {
            value: "true",
            goal: {
              kind: "not",
              goal: { kind: "atom", atom: activeSanction({ person: cara }) },
            },
            bindings: [[P, cara]],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "false",
                    goal: {
                      kind: "atom",
                      atom: activeSanction({ person: cara }),
                    },
                    bindings: [[P, cara]],
                    negative: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "-",
                            atom: activeSanction({ person: cara }),
                            metadata: sanctionsRegistry,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      value: "conflicted",
      goal: { kind: "atom", atom: eligible({ person: drew }) },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: eligibilityRule,
          body: {
            value: "conflicted",
            goal: {
              kind: "not",
              goal: { kind: "atom", atom: activeSanction({ person: drew }) },
            },
            bindings: [[P, drew]],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "conflicted",
                    goal: {
                      kind: "atom",
                      atom: activeSanction({ person: drew }),
                    },
                    bindings: [[P, drew]],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: activeSanction({ person: drew }),
                            metadata: sanctionsRegistry,
                          },
                        ],
                      },
                    ],
                    negative: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "-",
                            atom: activeSanction({ person: drew }),
                            metadata: appealsBoard,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "conflicted",
                    goal: {
                      kind: "atom",
                      atom: activeSanction({ person: drew }),
                    },
                    bindings: [[P, drew]],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: activeSanction({ person: drew }),
                            metadata: sanctionsRegistry,
                          },
                        ],
                      },
                    ],
                    negative: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "-",
                            atom: activeSanction({ person: drew }),
                            metadata: appealsBoard,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: eligibilityRule,
          body: {
            value: "conflicted",
            goal: {
              kind: "not",
              goal: { kind: "atom", atom: activeSanction({ person: drew }) },
            },
            bindings: [[P, drew]],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "conflicted",
                    goal: {
                      kind: "atom",
                      atom: activeSanction({ person: drew }),
                    },
                    bindings: [[P, drew]],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: activeSanction({ person: drew }),
                            metadata: sanctionsRegistry,
                          },
                        ],
                      },
                    ],
                    negative: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "-",
                            atom: activeSanction({ person: drew }),
                            metadata: appealsBoard,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "conflicted",
                    goal: {
                      kind: "atom",
                      atom: activeSanction({ person: drew }),
                    },
                    bindings: [[P, drew]],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: activeSanction({ person: drew }),
                            metadata: sanctionsRegistry,
                          },
                        ],
                      },
                    ],
                    negative: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "-",
                            atom: activeSanction({ person: drew }),
                            metadata: appealsBoard,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
};
