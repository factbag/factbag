/**
 * Reuse of ground judgments within one query. A judgment is keyed by the active atoms its
 * predicate can reach, so one computed while another atom of its recursion was active is
 * never reused once that atom is not, while one that no active atom can influence is
 * shared, including across the fixed point that discovers a recursive predicate's
 * candidates. The programs are closed-world with exclusive definitions, where a wrong
 * reuse changes a definite answer rather than leaving it unknown.
 */
import { describe, expect, it } from "vitest";
import { and, closedPredicate, count, gte, letIn, not, or, variable } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query } from "../query";

class Node {
  constructor(readonly id: string) {}
}

const a = new Node("a");
const b = new Node("b");
const c = new Node("c");
const d = new Node("d");
const X = variable("X");
const Y = variable("Y");
const Z = variable("Z");
const N = variable("N");

const edge = closedPredicate("edge", { from: Node, to: Node });
const node = closedPredicate("node", { node: Node });
const flagged = closedPredicate("flagged", { node: Node });
const barred = closedPredicate("barred", { node: Node });
const reach = closedPredicate("reach", { from: Node, to: Node });
const unreached = closedPredicate("unreached", { from: Node, to: Node });
const reach_count = closedPredicate("reach_count", { from: Node, total: Number });

/**
 * Left-recursive reachability, where a step out of a barred node is not taken. The bar
 * depends on facts alone, so its judgments can be shared everywhere; the reachability
 * judgments depend on the recursion in progress.
 */
function graph(edges: readonly (readonly [Node, Node])[], flags: readonly Node[]): KnowledgeBase {
  const kb = new KnowledgeBase();
  kb.entities.add(a, b, c, d);
  for (const member of [a, b, c, d]) {
    kb.asserts(node({ node: member }));
  }
  for (const [from, to] of edges) {
    kb.asserts(edge({ from, to }));
  }
  for (const flag of flags) {
    kb.asserts(flagged({ node: flag }));
  }
  kb.rule(barred({ node: X })).iff(flagged({ node: X }));
  kb.rule(reach({ from: X, to: Y })).iff(
    or(
      edge({ from: X, to: Y }),
      and(reach({ from: X, to: Z }), not(barred({ node: Z })), edge({ from: Z, to: Y })),
    ),
  );
  kb.rule(unreached({ from: X, to: Y })).iff(
    and(node({ node: X }), node({ node: Y }), not(reach({ from: X, to: Y }))),
  );
  kb.rule(reach_count({ from: X, total: N })).iff(
    letIn(N, count(Y).where(reach({ from: X, to: Y })), gte(N, 0)),
  );
  return kb;
}

describe("judgment reuse across active recursion contexts", () => {
  // A two-cycle: a -> b -> a. Every node reaches itself and the other.
  const cycle = () =>
    graph(
      [
        [a, b],
        [b, a],
      ],
      [],
    );

  it("answers ground questions on the cycle", () => {
    const kb = cycle();
    expect(query(kb, reach({ from: a, to: b })).value).toBe("true");
    expect(query(kb, reach({ from: a, to: a })).value).toBe("true");
    expect(query(kb, reach({ from: b, to: b })).value).toBe("true");
    expect(query(kb, reach({ from: d, to: a })).value).toBe("false");
  });

  it("does not reuse a judgment reached while another atom of the recursion was active", () => {
    // Proving reach(a, b) visits reach(a, a) while reach(a, b) is active; there the step
    // back through reach(a, b) is cut, and reach(a, a) looks false. The second conjunct
    // asks reach(a, a) with nothing active: it must be recomputed, and is true.
    const both = closedPredicate("both", { from: Node });
    const kb = cycle();
    kb.rule(both({ from: X })).iff(and(reach({ from: X, to: b }), reach({ from: X, to: a })));
    expect(query(kb, both({ from: a })).value).toBe("true");
  });

  it("does not reuse such a judgment under a negation either", () => {
    const stranded = closedPredicate("stranded", { from: Node });
    const kb = cycle();
    kb.rule(stranded({ from: X })).iff(
      and(reach({ from: X, to: b }), not(reach({ from: X, to: a }))),
    );
    expect(query(kb, stranded({ from: a })).value).toBe("false");
    const reversed = cycle();
    reversed
      .rule(stranded({ from: X }))
      .iff(and(not(reach({ from: X, to: a })), reach({ from: X, to: b })));
    expect(query(reversed, stranded({ from: a })).value).toBe("false");
  });
});

describe("judgment reuse during a candidate fixed point", () => {
  // a -> b -> c -> a, and c -> d. Barring c cuts the cycle and the way to d.
  const edges: readonly (readonly [Node, Node])[] = [
    [a, b],
    [b, c],
    [c, a],
    [c, d],
  ];

  it("reaches around the cycle when nothing is barred", () => {
    const kb = graph(edges, []);
    expect(query(kb, reach({ from: a, to: a })).value).toBe("true");
    expect(query(kb, reach({ from: a, to: d })).value).toBe("true");
    expect(query(kb, reach({ from: d, to: a })).value).toBe("false");
    expect(query(kb, reach_count({ from: a, total: 4 })).value).toBe("true");
  });

  it("stops at a barred node, with the same answers by count and by ground query", () => {
    const kb = graph(edges, [c]);
    expect(query(kb, reach({ from: a, to: b })).value).toBe("true");
    expect(query(kb, reach({ from: a, to: c })).value).toBe("true");
    expect(query(kb, reach({ from: a, to: d })).value).toBe("false");
    expect(query(kb, reach({ from: a, to: a })).value).toBe("false");
    expect(query(kb, reach_count({ from: a, total: 2 })).value).toBe("true");
    expect(query(kb, reach_count({ from: a, total: 4 })).value).toBe("false");
  });

  it("negates the recursive predicate consistently with the ground answers", () => {
    const kb = graph(edges, [c]);
    expect(query(kb, unreached({ from: a, to: d })).value).toBe("true");
    expect(query(kb, unreached({ from: a, to: a })).value).toBe("true");
    expect(query(kb, unreached({ from: a, to: c })).value).toBe("false");
    // The bar stops steps out of c, not steps into it: b reaches c and nothing beyond.
    expect(query(kb, unreached({ from: b, to: c })).value).toBe("false");
    expect(query(kb, unreached({ from: b, to: d })).value).toBe("true");
    expect(query(kb, unreached({ from: b, to: a })).value).toBe("true");
  });
});
