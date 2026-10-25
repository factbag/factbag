import { describe, expect, it } from "vitest";
import { predicate } from "../../dsl";
import { reachablePredicates, stronglyConnectedComponents, type Edge } from "./utils";

describe("stronglyConnectedComponents", () => {
  it("separates two cycles, a self-loop, and an acyclic tail", () => {
    // Arrange
    const a = predicate("a", {});
    const b = predicate("b", {});
    const c = predicate("c", {});
    const d = predicate("d", {});
    const e = predicate("e", {});
    const f = predicate("f", {});
    const g = predicate("g", {});
    const edges: Edge[] = [
      { from: a, to: b, kind: "positive" },
      { from: b, to: a, kind: "positive" },
      { from: b, to: c, kind: "positive" },
      { from: c, to: d, kind: "positive" },
      { from: d, to: c, kind: "positive" },
      { from: d, to: e, kind: "positive" },
      { from: e, to: e, kind: "positive" },
      { from: e, to: f, kind: "positive" },
      { from: f, to: g, kind: "positive" },
    ];

    // Act
    const components = stronglyConnectedComponents(edges);

    // Assert
    expect(components).toEqual(
      new Map([
        [a, new Set([a, b])],
        [b, new Set([a, b])],
        [c, new Set([c, d])],
        [d, new Set([c, d])],
        [e, new Set([e])],
        [f, new Set([f])],
        [g, new Set([g])],
      ]),
    );
    expect(components.get(a)).toBe(components.get(b));
    expect(components.get(c)).toBe(components.get(d));
  });

  it("returns no components for an empty graph", () => {
    // Arrange
    const edges: Edge[] = [];
    // Act
    const components = stronglyConnectedComponents(edges);
    // Assert
    expect(components).toEqual(new Map());
  });
});

describe("reachablePredicates", () => {
  it("includes the start and traverses directed cycles without crossing backwards", () => {
    // Arrange
    const a = predicate("a", {});
    const b = predicate("b", {});
    const c = predicate("c", {});
    const edges: Edge[] = [
      { from: a, to: b, kind: "positive" },
      { from: b, to: a, kind: "positive" },
      { from: c, to: b, kind: "positive" },
    ];
    // Act
    const reachable = reachablePredicates(a, edges);
    // Assert
    expect(reachable).toEqual(new Set([a, b]));
  });
});
