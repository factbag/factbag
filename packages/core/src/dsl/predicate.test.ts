import { expect, it } from "vitest";
import { closedPredicate, predicate } from "./predicate";
import { KnowledgeBase } from "../knowledge-base/knowledge-base";
import { query } from "../query/query";

it("carries domain metadata and evidence annotations through a core judgment", () => {
  const metadata = {
    description: "The supplied name is registered.",
    instructions: "Match exactly.",
  };
  for (const declare of [predicate, closedPredicate]) {
    const registered = declare("registered", { name: String }, metadata);
    const atom = registered({ name: "Alice" });
    const kb = new KnowledgeBase();
    const literal = kb.asserts(atom, {
      source: "register",
      scores: { probability: 0.8 },
      annotations: { assessment: { choices: ["ASSERT", "DENY"], reviewed: false } },
    });
    const judgment = query(kb, atom);
    expect(atom.predicate.metadata).toEqual(metadata);
    expect(judgment.value).toBe("true");
    expect(judgment.positive).toContainEqual({ source: "evidence", literals: [literal] });
    expect(JSON.parse(JSON.stringify(literal.metadata))).toEqual(literal.metadata);
  }
});
