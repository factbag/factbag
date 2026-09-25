/**
 * Entity identity is the id (scoped by type), not the object reference:
 * facts filed by one source answer queries minted elsewhere, and rule
 * joins unify entities re-constructed per document. This is what lets
 * independent ingestion passes talk about the same subject without
 * sharing object instances.
 */
import { describe, expect, it } from "vitest";
import { and, predicate, variable } from "../dsl";
import { KnowledgeBase } from "../knowledge-base/knowledge-base";
import { query } from "../query/query";
import { assertGroundAtom } from "../types/atom";
import type { Atom } from "../types/atom";
import type { QueryJudgment } from "../types/judgment";
import type { PredicateSchema } from "../types/schema";

class Person {
  constructor(readonly id: string) {}
}

function queryGround<Schema extends PredicateSchema>(
  kb: KnowledgeBase,
  atom: Atom<Schema>,
): QueryJudgment<Schema> {
  assertGroundAtom(atom);
  return query(kb, atom);
}

describe("entity identity across instances", () => {
  it("answers a query minted independently of the filed evidence", () => {
    const hasCard = predicate("has_card", { person: Person });
    const kb = new KnowledgeBase();
    kb.asserts(hasCard({ person: new Person("mia") }), { source: "front_desk" });

    expect(queryGround(kb, hasCard({ person: new Person("mia") })).value).toBe("true");
  });

  it("keeps distinct ids distinct", () => {
    const hasCard = predicate("has_card", { person: Person });
    const kb = new KnowledgeBase();
    kb.asserts(hasCard({ person: new Person("mia") }));

    expect(queryGround(kb, hasCard({ person: new Person("zoe") })).value).toBe("unknown");
  });

  it("joins a rule chain across documents that each minted their own instances", () => {
    const parentOf = predicate("parent_of", { child: Person, parent: Person });
    const grandparentOf = predicate("grandparent_of", {
      grandchild: Person,
      grandparent: Person,
    });
    const C = variable("C");
    const G = variable("G");
    const P = variable("P");

    const kb = new KnowledgeBase();
    kb.rule(grandparentOf({ grandchild: C, grandparent: G })).iff(
      and(parentOf({ child: P, parent: G }), parentOf({ child: C, parent: P })),
    );
    kb.asserts(parentOf({ child: new Person("june"), parent: new Person("milo") }), {
      source: "hospital_record",
    });
    kb.asserts(parentOf({ child: new Person("rosa"), parent: new Person("june") }), {
      source: "registry_office",
    });

    const verdict = queryGround(
      kb,
      grandparentOf({ grandchild: new Person("rosa"), grandparent: new Person("milo") }),
    );
    expect(verdict.value).toBe("true");
  });
});
