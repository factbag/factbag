import { expect } from "vitest";
import {
  and,
  closedPredicate,
  count,
  gte,
  letIn,
  not,
  or,
  predicate,
  variable,
} from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

const A = variable("A");
const B = variable("B");
const X = variable("X");
const edge = closedPredicate("edge", { a: Number, b: Number });
const ancestor = closedPredicate("ancestor", { a: Number, b: Number });
const sibling = closedPredicate("sibling", { a: Number, b: Number });
const ancestorRule = {
  kind: "iff",
  head: { sign: "+", atom: ancestor({ a: A, b: B }) },
  body: or(edge({ a: A, b: B }), and(ancestor({ a: A, b: X }), ancestor({ a: X, b: B }))),
} as const;
const siblingRule = {
  kind: "iff",
  head: { sign: "+", atom: sibling({ a: A, b: B }) },
  body: or(
    edge({ a: A, b: B }),
    edge({ a: B, b: A }),
    and(sibling({ a: A, b: X }), sibling({ a: X, b: B })),
  ),
} as const;
const descendant = closedPredicate("descendant", { a: Number, b: Number });
const manyDescendants = closedPredicate("many_descendants", { a: Number });
const unreachable = closedPredicate("unreachable", { a: Number, b: Number });
const N = variable("N");
const descendantRule = {
  kind: "iff",
  head: { sign: "+", atom: descendant({ a: A, b: B }) },
  body: ancestor({ a: A, b: B }),
} as const;
const countRule = {
  kind: "iff",
  head: { sign: "+", atom: manyDescendants({ a: A }) },
  body: letIn(N, count(X).where(ancestor({ a: A, b: X })), gte(N, 4)),
} as const;
const absenceRule = {
  kind: "iff",
  head: { sign: "+", atom: unreachable({ a: A, b: B }) },
  body: not(ancestor({ a: A, b: B })),
} as const;

function chain(seeded = true) {
  const literals = seeded
    ? [0, 1, 2, 3].map((a) => ({ sign: "+" as const, atom: edge({ a, b: a + 1 }) }))
    : [];
  return {
    build(kb: KnowledgeBase) {
      for (const literal of literals) {
        kb.asserts(literal.atom);
      }
      kb.rule(ancestorRule.head.atom).iff(ancestorRule.body);
      kb.rule(siblingRule.head.atom).iff(siblingRule.body);
      kb.rule(descendantRule.head.atom).iff(descendantRule.body);
      kb.rule(countRule.head.atom).iff(countRule.body);
      kb.rule(absenceRule.head.atom).iff(absenceRule.body);
    },
    expectedKnowledgeBase: {
      literals,
      rules: [ancestorRule, siblingRule, descendantRule, countRule, absenceRule],
    },
  };
}

const closed = closedPredicate("closed", { n: Number });
const other = closedPredicate("other", { n: Number });
const open = predicate("open", { n: Number });
const closedRule = {
  kind: "iff",
  head: { sign: "+", atom: closed({ n: A }) },
  body: other({ n: A }),
} as const;
const otherRule = {
  kind: "iff",
  head: { sign: "+", atom: other({ n: A }) },
  body: closed({ n: A }),
} as const;
const toOpen = {
  kind: "iff",
  head: { sign: "+", atom: closed({ n: A }) },
  body: open({ n: A }),
} as const;
const fromOpen = {
  kind: "iff",
  head: { sign: "+", atom: open({ n: A }) },
  body: closed({ n: A }),
} as const;

export const tabledRecursionTestCases: readonly DslTestSpec[] = [
  {
    ...chain(),
    name: "tabled recursion: doubly recursive ancestor ground queries",
    invariant: "Composing the derived relation with itself preserves directed reachability.",
    narration: "Four forward edges imply 0 reaches 4, but neither the reverse nor a self-relation.",
    queryAtoms: [ancestor({ a: 0, b: 4 }), ancestor({ a: 4, b: 0 }), ancestor({ a: 3, b: 3 })],
    expectedProofs: [
      ruleProof(ancestor({ a: 0, b: 4 }), "true", ancestorRule, [
        [A, 0],
        [B, 4],
      ]),
      ruleProof(ancestor({ a: 4, b: 0 }), "false", ancestorRule, [
        [A, 4],
        [B, 0],
      ]),
      ruleProof(ancestor({ a: 3, b: 3 }), "false", ancestorRule, [
        [A, 3],
        [B, 3],
      ]),
    ],
  },
  {
    ...chain(),
    name: "tabled recursion: enumerate every descendant",
    invariant: "Candidate discovery and ground tabling agree on all reachable descendants.",
    narration: "A variable query from 0 lists exactly 1, 2, 3, and 4 with rule support.",
    queryAtoms: ancestor({ a: 0, b: X }),
    expectedProofs: [1, 2, 3, 4].map((b) =>
      ruleProof(ancestor({ a: 0, b }), "true", ancestorRule, [
        [A, 0],
        [B, b],
      ]),
    ),
  },
  {
    ...chain(),
    name: "tabled recursion: higher candidate discovery reads settled lower judgments",
    invariant:
      "A table started during discovery of a higher component sees complete lower candidate tables.",
    narration:
      "An alias of ancestor enumerates the same four descendants, even though it proves them during its own discovery.",
    queryAtoms: descendant({ a: 0, b: X }),
    expectedProofs: [1, 2, 3, 4].map((b) =>
      ruleProof(descendant({ a: 0, b }), "true", descendantRule, [
        [A, 0],
        [B, b],
      ]),
    ),
  },
  {
    ...chain(),
    name: "tabled recursion: aggregates and negation read final values",
    invariant: "Higher strata must not observe the component's initial absence or partial closure.",
    narration:
      "Zero has four descendants, one has only three, and only the reversed path is unreachable.",
    queryAtoms: [
      manyDescendants({ a: 0 }),
      manyDescendants({ a: 1 }),
      unreachable({ a: 4, b: 0 }),
      unreachable({ a: 0, b: 4 }),
    ],
    expectedProofs: [
      ruleProof(manyDescendants({ a: 0 }), "true", countRule, [
        [A, 0],
        [N, 4],
      ]),
      ruleProof(manyDescendants({ a: 1 }), "false", countRule, [
        [A, 1],
        [N, 3],
      ]),
      ruleProof(unreachable({ a: 4, b: 0 }), "true", absenceRule, [
        [A, 4],
        [B, 0],
      ]),
      ruleProof(unreachable({ a: 0, b: 4 }), "false", absenceRule, [
        [A, 0],
        [B, 4],
      ]),
    ],
  },
  {
    ...chain(),
    name: "tabled recursion: symmetric transitive closure",
    invariant:
      "Symmetry and self-composition connect the chain in both directions, including itself.",
    narration:
      "The endpoints are siblings in either direction; a round trip also derives a self-relation.",
    queryAtoms: [sibling({ a: 0, b: 4 }), sibling({ a: 4, b: 0 }), sibling({ a: 3, b: 3 })],
    expectedProofs: [
      ruleProof(sibling({ a: 0, b: 4 }), "true", siblingRule, [
        [A, 0],
        [B, 4],
      ]),
      ruleProof(sibling({ a: 4, b: 0 }), "true", siblingRule, [
        [A, 4],
        [B, 0],
      ]),
      ruleProof(sibling({ a: 3, b: 3 }), "true", siblingRule, [
        [A, 3],
        [B, 3],
      ]),
    ],
  },
  {
    ...chain(),
    name: "tabled recursion: enumerate symmetric closure",
    invariant: "Settling one candidate does not leave later candidates with partial judgments.",
    narration: "Every vertex in the connected chain is related to 0, including 0 itself.",
    queryAtoms: sibling({ a: 0, b: X }),
    expectedProofs: [1, 2, 0, 3, 4].map((b) =>
      ruleProof(sibling({ a: 0, b }), "true", siblingRule, [
        [A, 0],
        [B, b],
      ]),
    ),
  },
  {
    ...chain(false),
    name: "tabled recursion: an unseeded closure has no candidates",
    invariant: "Candidate discovery must not manufacture rows from a cycle alone.",
    narration: "The non-recursive edge alternative admits enumeration but supplies no seed rows.",
    queryAtoms: ancestor({ a: 0, b: X }),
    expectedProofs: [],
  },
  {
    ...chain(false),
    name: "tabled recursion: an unseeded cycle derives nothing",
    invariant: "A closed recursive component starts at absence, not self-supported truth.",
    narration: "Without edges, neither closure derives a ground relation.",
    queryAtoms: [ancestor({ a: 0, b: 4 }), sibling({ a: 0, b: 4 })],
    expectedProofs: [
      ruleProof(ancestor({ a: 0, b: 4 }), "false", ancestorRule, [
        [A, 0],
        [B, 4],
      ]),
      ruleProof(sibling({ a: 0, b: 4 }), "false", siblingRule, [
        [A, 0],
        [B, 4],
      ]),
    ],
  },
  {
    name: "tabled recursion control: a denial excludes the whole component",
    invariant: "Any literal on any member keeps the existing search semantics for every member.",
    narration: "The denied closed atom and its mutually defined partner remain false.",
    build(kb) {
      kb.denies(closed({ n: 0 }));
      kb.rule(closedRule.head.atom).iff(closedRule.body);
      kb.rule(otherRule.head.atom).iff(otherRule.body);
    },
    expectedKnowledgeBase: {
      literals: [{ sign: "-", atom: closed({ n: 0 }) }],
      rules: [closedRule, otherRule],
    },
    queryAtoms: [closed({ n: 0 }), other({ n: 0 })],
    expectedProofs: [
      ruleProof(closed({ n: 0 }), "false", closedRule, [[A, 0]]),
      ruleProof(other({ n: 0 }), "false", otherRule, [[A, 0]]),
    ],
  },
  {
    name: "tabled recursion control: a mixed-world cycle keeps entry-dependent answers",
    invariant: "An open-world member excludes the entire component from tabling.",
    narration:
      "As before, entering the closed side yields false while entering the open side yields unknown.",
    build(kb) {
      kb.rule(toOpen.head.atom).iff(toOpen.body);
      kb.rule(fromOpen.head.atom).iff(fromOpen.body);
    },
    expectedKnowledgeBase: { literals: [], rules: [toOpen, fromOpen] },
    queryAtoms: [closed({ n: 0 }), open({ n: 0 })],
    expectedProofs: [
      ruleProof(closed({ n: 0 }), "false", toOpen, [[A, 0]]),
      expect.objectContaining({
        value: "unknown",
        goal: { kind: "atom", atom: open({ n: 0 }) },
        bindings: [],
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- Asymmetric support expectation.
        inconclusive: expect.arrayContaining([
          expect.objectContaining({
            source: "rule",
            rule: fromOpen,
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- Asymmetric body expectation.
            body: expect.objectContaining({ value: "unknown", bindings: [[A, 0]] }),
          }),
        ]),
      }),
    ],
  },
];
