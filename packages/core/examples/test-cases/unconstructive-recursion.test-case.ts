import { and, closedPredicate, count, gte, letIn, not, predicate, variable } from "../../src/dsl";
import { UnconstructiveRecursionProgrammerError } from "../../src/exceptions/programmer-errors";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const bob = new Person("bob");
const carol = new Person("carol");
const P = variable("P");
const A = variable("A");
const B = variable("B");
const C = variable("C");
const Reason = variable("Reason");
const Count = variable("Count");
const Target = variable("Target");

const controllerRegistryMatch = predicate("controller_registry_match", { person: Person });
const beneficialOwner = predicate("beneficial_owner", { person: Person });
const caseReviewRequired = predicate("case_review_required", { person: Person });
const activeDisqualifyingInfection = predicate("active_disqualifying_infection", {
  person: Person,
});
const trialSafetyClearance = predicate("trial_safety_clearance", { person: Person });

const beneficialOwnerFromControllerRegistry = {
  head: { sign: "+", atom: beneficialOwner({ person: P }) },
  kind: "if",
  body: controllerRegistryMatch({ person: P }),
} as const;

const beneficialOwnerFromCaseReview = {
  head: { sign: "+", atom: beneficialOwner({ person: P }) },
  kind: "if",
  body: caseReviewRequired({ person: P }),
} as const;

const caseReviewFromBeneficialOwner = {
  head: { sign: "+", atom: caseReviewRequired({ person: P }) },
  kind: "iff",
  body: beneficialOwner({ person: P }),
} as const;

const safetyClearanceFromNoInfection = {
  head: { sign: "+", atom: trialSafetyClearance({ person: P }) },
  kind: "if",
  body: not(activeDisqualifyingInfection({ person: P })),
} as const;

const safetyClearanceFromCaseReview = {
  head: { sign: "+", atom: trialSafetyClearance({ person: P }) },
  kind: "if",
  body: caseReviewRequired({ person: P }),
} as const;

const caseReviewFromSafetyClearance = {
  head: { sign: "+", atom: caseReviewRequired({ person: P }) },
  kind: "iff",
  body: trialSafetyClearance({ person: P }),
} as const;

const infectionFromSafetyClearance = {
  head: { sign: "+", atom: activeDisqualifyingInfection({ person: P }) },
  kind: "iff",
  body: trialSafetyClearance({ person: P }),
} as const;

const paymentAllowed = closedPredicate("payment_allowed", { person: Person });
const paymentBlocked = closedPredicate("payment_blocked", { person: Person });
const paymentAllowedFromNotBlocked = {
  head: { sign: "+", atom: paymentAllowed({ person: P }) },
  kind: "iff",
  body: not(paymentBlocked({ person: P })),
} as const;
const paymentBlockedFromNotAllowed = {
  head: { sign: "+", atom: paymentBlocked({ person: P }) },
  kind: "iff",
  body: not(paymentAllowed({ person: P })),
} as const;

const benefitApproved = predicate("benefit_approved", { person: Person });
const benefitExcluded = closedPredicate("benefit_excluded", { person: Person });
const beneficialOwnerFromBenefitApproval = {
  head: { sign: "+", atom: beneficialOwner({ person: P }) },
  kind: "iff",
  body: benefitApproved({ person: P }),
} as const;
const benefitApprovedFromNotExcluded = {
  head: { sign: "+", atom: benefitApproved({ person: P }) },
  kind: "iff",
  body: not(benefitExcluded({ person: P })),
} as const;
const benefitExcludedFromBeneficialOwner = {
  head: { sign: "+", atom: benefitExcluded({ person: P }) },
  kind: "iff",
  body: beneficialOwner({ person: P }),
} as const;

const manualReviewReason = predicate("manual_review_reason", {
  person: Person,
  manualReviewReason: String,
});
const manualReviewRequired = predicate("manual_review_required", { person: Person });
const manualReviewFromReasonCount = {
  head: { sign: "+", atom: manualReviewRequired({ person: P }) },
  kind: "iff",
  body: letIn(
    Count,
    count(Reason).where(manualReviewReason({ person: P, manualReviewReason: Reason })),
    gte(Count, 2),
  ),
} as const;
const reasonFromManualReview = {
  head: { sign: "+", atom: manualReviewReason({ person: P, manualReviewReason: "recursive" }) },
  kind: "iff",
  body: manualReviewRequired({ person: P }),
} as const;

const directManager = predicate("direct_manager", { from: Person, to: Person });
const managementChain = predicate("management_chain", { from: Person, to: Person });
const directManagementChainRule = {
  head: { sign: "+", atom: managementChain({ from: A, to: B }) },
  kind: "if",
  body: directManager({ from: A, to: B }),
} as const;
const finiteManagementChainRule = {
  head: { sign: "+", atom: managementChain({ from: A, to: C }) },
  kind: "if",
  body: and(directManager({ from: A, to: B }), managementChain({ from: B, to: C })),
} as const;
const unanchoredManagementChainRule = {
  head: { sign: "+", atom: managementChain({ from: A, to: C }) },
  kind: "iff",
  body: and(managementChain({ from: A, to: B }), directManager({ from: B, to: C })),
} as const;

export const constructiveRecursionBoundaryTestCases: readonly DslTestSpec[] = [
  {
    name: "ownership review: conflict propagates through positive recursion",
    invariant:
      "A positive ownership-review cycle remains constructive even when the controller-registry base evidence is conflicted; the conflict should propagate with both positive and negative support.",
    narration:
      "A person is a beneficial owner if case review is required, and case review is required if the person is a beneficial owner. A controller-registry match is also a sufficient base for beneficial ownership. Alice has both positive and negative controller-registry evidence, so case_review_required(alice) is conflicted through the constructive positive cycle.",
    build(kb) {
      kb.asserts(controllerRegistryMatch({ person: alice }));
      kb.denies(controllerRegistryMatch({ person: alice }));
      kb.rule(beneficialOwnerFromControllerRegistry.head.atom).if(
        beneficialOwnerFromControllerRegistry.body,
      );
      kb.rule(beneficialOwnerFromCaseReview.head.atom).if(beneficialOwnerFromCaseReview.body);
      kb.rule(caseReviewFromBeneficialOwner.head.atom).iff(caseReviewFromBeneficialOwner.body);
    },
    expectedKnowledgeBase: {
      literals: [
        { sign: "+", atom: controllerRegistryMatch({ person: alice }) },
        { sign: "-", atom: controllerRegistryMatch({ person: alice }) },
      ],
      rules: [
        beneficialOwnerFromControllerRegistry,
        beneficialOwnerFromCaseReview,
        caseReviewFromBeneficialOwner,
      ],
    },
    queryAtoms: caseReviewRequired({ person: alice }),
    expectedProofs: {
      value: "conflicted",
      goal: { kind: "atom", atom: caseReviewRequired({ person: alice }) },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: caseReviewFromBeneficialOwner,
          body: {
            value: "conflicted",
            goal: { kind: "atom", atom: beneficialOwner({ person: alice }) },
            bindings: [[P, alice]],
            positive: [
              {
                source: "rule",
                rule: beneficialOwnerFromControllerRegistry,
                body: {
                  value: "conflicted",
                  goal: { kind: "atom", atom: controllerRegistryMatch({ person: alice }) },
                  bindings: [[P, alice]],
                  positive: [
                    {
                      source: "evidence",
                      literals: [{ sign: "+", atom: controllerRegistryMatch({ person: alice }) }],
                    },
                  ],
                  negative: [
                    {
                      source: "evidence",
                      literals: [{ sign: "-", atom: controllerRegistryMatch({ person: alice }) }],
                    },
                  ],
                },
              },
            ],
            negative: [
              {
                source: "rule",
                rule: beneficialOwnerFromControllerRegistry,
                body: {
                  value: "conflicted",
                  goal: { kind: "atom", atom: controllerRegistryMatch({ person: alice }) },
                  bindings: [[P, alice]],
                  positive: [
                    {
                      source: "evidence",
                      literals: [{ sign: "+", atom: controllerRegistryMatch({ person: alice }) }],
                    },
                  ],
                  negative: [
                    {
                      source: "evidence",
                      literals: [{ sign: "-", atom: controllerRegistryMatch({ person: alice }) }],
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: caseReviewFromBeneficialOwner,
          body: {
            value: "conflicted",
            goal: { kind: "atom", atom: beneficialOwner({ person: alice }) },
            bindings: [[P, alice]],
            positive: [
              {
                source: "rule",
                rule: beneficialOwnerFromControllerRegistry,
                body: {
                  value: "conflicted",
                  goal: { kind: "atom", atom: controllerRegistryMatch({ person: alice }) },
                  bindings: [[P, alice]],
                  positive: [
                    {
                      source: "evidence",
                      literals: [{ sign: "+", atom: controllerRegistryMatch({ person: alice }) }],
                    },
                  ],
                  negative: [
                    {
                      source: "evidence",
                      literals: [{ sign: "-", atom: controllerRegistryMatch({ person: alice }) }],
                    },
                  ],
                },
              },
            ],
            negative: [
              {
                source: "rule",
                rule: beneficialOwnerFromControllerRegistry,
                body: {
                  value: "conflicted",
                  goal: { kind: "atom", atom: controllerRegistryMatch({ person: alice }) },
                  bindings: [[P, alice]],
                  positive: [
                    {
                      source: "evidence",
                      literals: [{ sign: "+", atom: controllerRegistryMatch({ person: alice }) }],
                    },
                  ],
                  negative: [
                    {
                      source: "evidence",
                      literals: [{ sign: "-", atom: controllerRegistryMatch({ person: alice }) }],
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    name: "clinical safety: external negative infection evidence may feed a positive cycle",
    invariant:
      "Explicit negative infection evidence is allowed when it is outside the recursive SCC; the recursive SCC itself still has only positive constructive edges.",
    narration:
      "Trial safety clearance is defined by explicit negative evidence for active disqualifying infection, and safety clearance participates in a positive cycle with case_review_required. Alice has negative infection evidence, so case_review_required(alice) is true without treating the explicit negation edge as recursive self-support.",
    build(kb) {
      kb.denies(activeDisqualifyingInfection({ person: alice }));
      kb.rule(safetyClearanceFromNoInfection.head.atom).if(safetyClearanceFromNoInfection.body);
      kb.rule(safetyClearanceFromCaseReview.head.atom).if(safetyClearanceFromCaseReview.body);
      kb.rule(caseReviewFromSafetyClearance.head.atom).iff(caseReviewFromSafetyClearance.body);
    },
    expectedKnowledgeBase: {
      literals: [{ sign: "-", atom: activeDisqualifyingInfection({ person: alice }) }],
      rules: [
        safetyClearanceFromNoInfection,
        safetyClearanceFromCaseReview,
        caseReviewFromSafetyClearance,
      ],
    },
    queryAtoms: caseReviewRequired({ person: alice }),
    expectedProofs: {
      value: "true",
      goal: { kind: "atom", atom: caseReviewRequired({ person: alice }) },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: caseReviewFromSafetyClearance,
          body: {
            value: "true",
            goal: { kind: "atom", atom: trialSafetyClearance({ person: alice }) },
            bindings: [[P, alice]],
            positive: [
              {
                source: "rule",
                rule: safetyClearanceFromNoInfection,
                body: {
                  value: "true",
                  goal: {
                    kind: "not",
                    goal: { kind: "atom", atom: activeDisqualifyingInfection({ person: alice }) },
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
                            atom: activeDisqualifyingInfection({ person: alice }),
                          },
                          bindings: [[P, alice]],
                          negative: [
                            {
                              source: "evidence",
                              literals: [
                                {
                                  sign: "-",
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
        },
      ],
    },
  },
  {
    name: "clinical safety: external infection conflict preserves conflict",
    invariant:
      "A conflict outside a positive recursive SCC can pass through explicit negation and make the constructive recursive conclusion conflicted.",
    narration:
      "Trial safety clearance is defined by not(active_disqualifying_infection(P)), and safety clearance participates in a positive cycle with case_review_required. Alice has conflicting infection evidence, so explicit negation preserves the conflict and case_review_required(alice) is conflicted.",
    build(kb) {
      kb.asserts(activeDisqualifyingInfection({ person: alice }));
      kb.denies(activeDisqualifyingInfection({ person: alice }));
      kb.rule(safetyClearanceFromNoInfection.head.atom).if(safetyClearanceFromNoInfection.body);
      kb.rule(safetyClearanceFromCaseReview.head.atom).if(safetyClearanceFromCaseReview.body);
      kb.rule(caseReviewFromSafetyClearance.head.atom).iff(caseReviewFromSafetyClearance.body);
    },
    expectedKnowledgeBase: {
      literals: [
        { sign: "+", atom: activeDisqualifyingInfection({ person: alice }) },
        { sign: "-", atom: activeDisqualifyingInfection({ person: alice }) },
      ],
      rules: [
        safetyClearanceFromNoInfection,
        safetyClearanceFromCaseReview,
        caseReviewFromSafetyClearance,
      ],
    },
    queryAtoms: caseReviewRequired({ person: alice }),
    expectedProofs: {
      value: "conflicted",
      goal: { kind: "atom", atom: caseReviewRequired({ person: alice }) },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: caseReviewFromSafetyClearance,
          body: {
            value: "conflicted",
            goal: { kind: "atom", atom: trialSafetyClearance({ person: alice }) },
            bindings: [[P, alice]],
            positive: [
              {
                source: "rule",
                rule: safetyClearanceFromNoInfection,
                body: {
                  value: "conflicted",
                  goal: {
                    kind: "not",
                    goal: { kind: "atom", atom: activeDisqualifyingInfection({ person: alice }) },
                  },
                  bindings: [[P, alice]],
                  positive: [
                    {
                      source: "subgoals",
                      judgments: [
                        {
                          value: "conflicted",
                          goal: {
                            kind: "atom",
                            atom: activeDisqualifyingInfection({ person: alice }),
                          },
                          bindings: [[P, alice]],
                          positive: [
                            {
                              source: "evidence",
                              literals: [
                                {
                                  sign: "+",
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                            atom: activeDisqualifyingInfection({ person: alice }),
                          },
                          bindings: [[P, alice]],
                          positive: [
                            {
                              source: "evidence",
                              literals: [
                                {
                                  sign: "+",
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                rule: safetyClearanceFromNoInfection,
                body: {
                  value: "conflicted",
                  goal: {
                    kind: "not",
                    goal: { kind: "atom", atom: activeDisqualifyingInfection({ person: alice }) },
                  },
                  bindings: [[P, alice]],
                  positive: [
                    {
                      source: "subgoals",
                      judgments: [
                        {
                          value: "conflicted",
                          goal: {
                            kind: "atom",
                            atom: activeDisqualifyingInfection({ person: alice }),
                          },
                          bindings: [[P, alice]],
                          positive: [
                            {
                              source: "evidence",
                              literals: [
                                {
                                  sign: "+",
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                            atom: activeDisqualifyingInfection({ person: alice }),
                          },
                          bindings: [[P, alice]],
                          positive: [
                            {
                              source: "evidence",
                              literals: [
                                {
                                  sign: "+",
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
        },
      ],
      negative: [
        {
          source: "rule",
          rule: caseReviewFromSafetyClearance,
          body: {
            value: "conflicted",
            goal: { kind: "atom", atom: trialSafetyClearance({ person: alice }) },
            bindings: [[P, alice]],
            positive: [
              {
                source: "rule",
                rule: safetyClearanceFromNoInfection,
                body: {
                  value: "conflicted",
                  goal: {
                    kind: "not",
                    goal: { kind: "atom", atom: activeDisqualifyingInfection({ person: alice }) },
                  },
                  bindings: [[P, alice]],
                  positive: [
                    {
                      source: "subgoals",
                      judgments: [
                        {
                          value: "conflicted",
                          goal: {
                            kind: "atom",
                            atom: activeDisqualifyingInfection({ person: alice }),
                          },
                          bindings: [[P, alice]],
                          positive: [
                            {
                              source: "evidence",
                              literals: [
                                {
                                  sign: "+",
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                            atom: activeDisqualifyingInfection({ person: alice }),
                          },
                          bindings: [[P, alice]],
                          positive: [
                            {
                              source: "evidence",
                              literals: [
                                {
                                  sign: "+",
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                rule: safetyClearanceFromNoInfection,
                body: {
                  value: "conflicted",
                  goal: {
                    kind: "not",
                    goal: { kind: "atom", atom: activeDisqualifyingInfection({ person: alice }) },
                  },
                  bindings: [[P, alice]],
                  positive: [
                    {
                      source: "subgoals",
                      judgments: [
                        {
                          value: "conflicted",
                          goal: {
                            kind: "atom",
                            atom: activeDisqualifyingInfection({ person: alice }),
                          },
                          bindings: [[P, alice]],
                          positive: [
                            {
                              source: "evidence",
                              literals: [
                                {
                                  sign: "+",
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                            atom: activeDisqualifyingInfection({ person: alice }),
                          },
                          bindings: [[P, alice]],
                          positive: [
                            {
                              source: "evidence",
                              literals: [
                                {
                                  sign: "+",
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
                                  atom: activeDisqualifyingInfection({ person: alice }),
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
        },
      ],
    },
  },
  {
    name: "management chain: finite grounded recursion is allowed",
    invariant:
      "Positive management-chain recursion is constructive when the recursive relation has a non-recursive direct-manager base rule.",
    narration:
      "management_chain(A, B) is seeded by direct_manager(A, B), and the recursive rule extends the chain through direct manager facts. Alice directly manages Bob, and Bob directly manages Carol, so management_chain(alice, carol) is derived through a finite grounded recursive path.",
    build(kb) {
      kb.asserts(directManager({ from: alice, to: bob }));
      kb.asserts(directManager({ from: bob, to: carol }));
      kb.rule(directManagementChainRule.head.atom).if(directManagementChainRule.body);
      kb.rule(finiteManagementChainRule.head.atom).if(finiteManagementChainRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        { sign: "+", atom: directManager({ from: alice, to: bob }) },
        { sign: "+", atom: directManager({ from: bob, to: carol }) },
      ],
      rules: [directManagementChainRule, finiteManagementChainRule],
    },
    queryAtoms: managementChain({ from: alice, to: carol }),
    expectedProofs: {
      value: "true",
      goal: { kind: "atom", atom: managementChain({ from: alice, to: carol }) },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: finiteManagementChainRule,
          body: {
            value: "true",
            goal: {
              kind: "and",
              goals: [
                { kind: "atom", atom: directManager({ from: alice, to: bob }) },
                { kind: "atom", atom: managementChain({ from: bob, to: carol }) },
              ],
            },
            bindings: [
              [A, alice],
              [C, carol],
              [B, bob],
            ],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "true",
                    goal: { kind: "atom", atom: directManager({ from: alice, to: bob }) },
                    bindings: [
                      [A, alice],
                      [C, carol],
                      [B, bob],
                    ],
                    positive: [
                      {
                        source: "evidence",
                        literals: [{ sign: "+", atom: directManager({ from: alice, to: bob }) }],
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: { kind: "atom", atom: managementChain({ from: bob, to: carol }) },
                    bindings: [
                      [A, alice],
                      [C, carol],
                      [B, bob],
                    ],
                    positive: [
                      {
                        source: "rule",
                        rule: directManagementChainRule,
                        body: {
                          value: "true",
                          goal: { kind: "atom", atom: directManager({ from: bob, to: carol }) },
                          bindings: [
                            [A, bob],
                            [B, carol],
                          ],
                          positive: [
                            {
                              source: "evidence",
                              literals: [
                                { sign: "+", atom: directManager({ from: bob, to: carol }) },
                              ],
                            },
                          ],
                        },
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
  },
];

export const unconstructiveRecursionTestCases: readonly DslTestSpec[] = [
  {
    name: "DOD: recursive clinical safety inversion is unconstructive recursion",
    invariant:
      "A recursive dependency cycle containing explicit negation should be rejected rather than evaluated as ordinary unknown/conflicted support.",
    narration:
      "Trial safety clearance depends on not(active_disqualifying_infection(P)), while active disqualifying infection depends back on safety clearance. The cycle supports itself through value inversion, so it is outside the constructive recursion fragment.",
    build(kb) {
      kb.rule(safetyClearanceFromNoInfection.head.atom).if(safetyClearanceFromNoInfection.body);
      kb.rule(infectionFromSafetyClearance.head.atom).iff(infectionFromSafetyClearance.body);
    },
    expectedKnowledgeBase: {
      literals: [],
      rules: [safetyClearanceFromNoInfection, infectionFromSafetyClearance],
    },
    queryAtoms: trialSafetyClearance({ person: alice }),
    expectedError: UnconstructiveRecursionProgrammerError,
  },
  {
    name: "DOD: circular payment absence policy is unconstructive recursion",
    invariant:
      "A recursive dependency cycle containing closed-world negation-as-failure should be rejected rather than deriving from absence of its own proof.",
    narration:
      "payment_allowed(P) is defined by the absence of payment_blocked(P), while payment_blocked(P) is defined by the absence of payment_allowed(P). The program asks absence to support itself recursively.",
    build(kb) {
      kb.rule(paymentAllowedFromNotBlocked.head.atom).iff(paymentAllowedFromNotBlocked.body);
      kb.rule(paymentBlockedFromNotAllowed.head.atom).iff(paymentBlockedFromNotAllowed.body);
    },
    expectedKnowledgeBase: {
      literals: [],
      rules: [paymentAllowedFromNotBlocked, paymentBlockedFromNotAllowed],
    },
    queryAtoms: paymentAllowed({ person: alice }),
    expectedError: UnconstructiveRecursionProgrammerError,
  },
  {
    name: "DOD: indirect benefits exclusion cycle is unconstructive recursion",
    invariant:
      "A larger recursive SCC is unconstructive when any edge in the cycle depends on closed-world negation-as-failure.",
    narration:
      "beneficial_owner(P) depends on benefit_approved(P), benefit_approved(P) depends on not(benefit_excluded(P)), and benefit_excluded(P) depends back on beneficial_owner(P). The negative edge is indirect but still belongs to the same recursive SCC.",
    build(kb) {
      kb.rule(beneficialOwnerFromBenefitApproval.head.atom).iff(
        beneficialOwnerFromBenefitApproval.body,
      );
      kb.rule(benefitApprovedFromNotExcluded.head.atom).iff(benefitApprovedFromNotExcluded.body);
      kb.rule(benefitExcludedFromBeneficialOwner.head.atom).iff(
        benefitExcludedFromBeneficialOwner.body,
      );
    },
    expectedKnowledgeBase: {
      literals: [],
      rules: [
        beneficialOwnerFromBenefitApproval,
        benefitApprovedFromNotExcluded,
        benefitExcludedFromBeneficialOwner,
      ],
    },
    queryAtoms: beneficialOwner({ person: alice }),
    expectedError: UnconstructiveRecursionProgrammerError,
  },
  {
    name: "DOD: recursive manual-review reason count is unconstructive recursion",
    invariant:
      "A recursive dependency cycle containing an aggregate should be rejected until the aggregate has an explicit supported monotonicity/completeness semantics.",
    narration:
      "manual_review_required(P) depends on a count of manual_review_reason(P, Reason), while manual_review_reason(P, 'recursive') depends back on manual_review_required(P). The aggregate is in the recursive SCC and is not yet classified as constructive.",
    build(kb) {
      kb.rule(manualReviewFromReasonCount.head.atom).iff(manualReviewFromReasonCount.body);
      kb.rule(reasonFromManualReview.head.atom).iff(reasonFromManualReview.body);
    },
    expectedKnowledgeBase: {
      literals: [],
      rules: [manualReviewFromReasonCount, reasonFromManualReview],
    },
    queryAtoms: manualReviewRequired({ person: alice }),
    expectedError: UnconstructiveRecursionProgrammerError,
  },
  {
    name: "DOD: unanchored management-chain enumeration is unconstructive recursion",
    invariant:
      "A recursive rule that can only discover generated answers through its own recursive predicate should be rejected when the query slice has no finite grounding boundary.",
    narration:
      "management_chain(A, C) depends on management_chain(A, B) and direct_manager(B, C), but there is no direct-manager base rule for the management_chain predicate. Querying management_chain(alice, Target) has no finite constructive seed for Target.",
    build(kb) {
      kb.rule(unanchoredManagementChainRule.head.atom).iff(unanchoredManagementChainRule.body);
    },
    expectedKnowledgeBase: {
      literals: [],
      rules: [unanchoredManagementChainRule],
    },
    queryAtoms: managementChain({ from: alice, to: Target }),
    expectedError: UnconstructiveRecursionProgrammerError,
  },
];
