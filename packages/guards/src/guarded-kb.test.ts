import { describe, expect, it } from "vitest";
import { closedPredicate, predicate, variable } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query, queryAll } from "@factbag/core/query";
import { GuardedKB, guard } from "./index";

const heldForOwner = predicate("held_for_owner", { company: String, owner: String });
const inForce = closedPredicate("in_force", { company: String });

function example(kb = new KnowledgeBase()) {
  return guard(kb)
    .permit("assert", heldForOwner, inForce)
    .permit("deny", heldForOwner, inForce)
    .permit("query", inForce)
    .block("deny", inForce);
}

describe("GuardedKB", () => {
  it("binds to the original KB and starts with no permissions", () => {
    const kb = new KnowledgeBase();
    kb.asserts(heldForOwner({ company: "Harbor", owner: "Oriole" }));

    const access = guard(kb);

    expect(access).toBeInstanceOf(GuardedKB);
    expect(access).not.toBeInstanceOf(KnowledgeBase);
    expect(access.kb).toBe(kb);
    expect(access.resolve()).toEqual([]);
    expect(new GuardedKB(kb).resolve()).toEqual([]);
    expect(access.resolve(heldForOwner)).toEqual([]);
    expect(kb.literals()).toHaveLength(1);
  });

  it("allows predicates before any facts exist and keeps branches independent", () => {
    const kb = new KnowledgeBase();
    const base = guard(kb).permit("query", heldForOwner);
    const writable = base.permit("assert", heldForOwner);
    const blocked = writable.block("assert", heldForOwner);

    expect(base.resolve("assert")).toEqual([]);
    expect(writable.resolve("assert")).toEqual([{ operation: "assert", predicate: heldForOwner }]);
    expect(blocked.resolve()).toEqual(base.resolve());
    expect(writable.kb).toBe(kb);
    expect(blocked.kb).toBe(kb);
    expect(kb.literals()).toEqual([]);
  });

  it("subtracts blocks regardless of order without affecting other operations", () => {
    const early = guard(new KnowledgeBase())
      .block("assert", heldForOwner)
      .permit("assert", heldForOwner)
      .permit("deny", heldForOwner)
      .permit("query", heldForOwner);
    const late = guard(early.kb)
      .permit("assert", heldForOwner)
      .permit("deny", heldForOwner)
      .permit("query", heldForOwner)
      .block("assert", heldForOwner);

    expect(early.resolve()).toEqual(late.resolve());
    expect(early.resolve()).toEqual([
      { operation: "deny", predicate: heldForOwner },
      { operation: "query", predicate: heldForOwner },
    ]);
  });

  it("deduplicates pairs in first-permitted order rather than grouping operations", () => {
    const access = guard(new KnowledgeBase())
      .permit("query", inForce)
      .permit("assert", heldForOwner, heldForOwner)
      .permit("query", heldForOwner, inForce)
      .permit("assert", inForce);

    expect(access.resolve()).toEqual([
      { operation: "query", predicate: inForce },
      { operation: "assert", predicate: heldForOwner },
      { operation: "query", predicate: heldForOwner },
      { operation: "assert", predicate: inForce },
    ]);
  });

  it("matches predicate identities rather than names", () => {
    const sameName = predicate("held_for_owner", { company: String, owner: String });
    const access = guard(new KnowledgeBase())
      .permit("assert", heldForOwner, sameName)
      .block("assert", heldForOwner);

    expect(access.resolve(heldForOwner)).toEqual([]);
    expect(access.resolve(sameName)).toHaveLength(1);
    expect(access.resolve()[0]?.predicate).toBe(sameName);
  });

  it("resolves all grants and supports operation and variadic predicate shorthand", () => {
    const access = example();

    expect(access.resolve()).toEqual([
      { operation: "assert", predicate: heldForOwner },
      { operation: "assert", predicate: inForce },
      { operation: "deny", predicate: heldForOwner },
      { operation: "query", predicate: inForce },
    ]);
    expect(access.resolve("assert")).toEqual([
      { operation: "assert", predicate: heldForOwner },
      { operation: "assert", predicate: inForce },
    ]);
    expect(access.resolve(inForce)).toEqual([
      { operation: "assert", predicate: inForce },
      { operation: "query", predicate: inForce },
    ]);
    expect(access.resolve(inForce, heldForOwner, inForce)).toEqual(access.resolve());
  });

  it("combines filters with OR within dimensions and AND between dimensions", () => {
    const access = example();

    expect(access.resolve({})).toEqual(access.resolve());
    expect(access.resolve({ operations: ["deny", "assert"] })).toEqual(
      access.resolve().filter(({ operation }) => operation !== "query"),
    );
    expect(access.resolve({ predicates: [inForce] })).toEqual(access.resolve(inForce));
    expect(access.resolve({ operations: ["deny", "query"], predicates: [inForce] })).toEqual([
      { operation: "query", predicate: inForce },
    ]);
    expect(access.resolve({ operations: ["deny"], predicates: [inForce, heldForOwner] })).toEqual([
      { operation: "deny", predicate: heldForOwner },
    ]);
    expect(access.resolve({ operations: [] })).toEqual([]);
    expect(access.resolve({ predicates: [] })).toEqual([]);
  });

  it("does not retain caller arrays or expose its internal rules through results", () => {
    const predicates = [heldForOwner];
    const access = guard(new KnowledgeBase()).permit("assert", ...predicates);
    predicates.length = 0;
    const result = access.resolve();
    // Runtime mutation by an untyped consumer must not alter the guard.
    const first = result[0];
    if (first === undefined) {
      throw new Error("Expected an assert grant");
    }
    Object.assign(first, { operation: "deny", predicate: inForce });

    expect(access.resolve()).toEqual([{ operation: "assert", predicate: heldForOwner }]);
  });

  it("rejects unpermitted operations before writing or evaluating", () => {
    const kb = new KnowledgeBase();
    const access = guard(kb);
    const atom = heldForOwner({ company: "Harbor", owner: "Oriole" });

    expect(() => access.asserts(atom)).toThrow('Operation "assert" is not permitted');
    expect(() => access.denies(atom)).toThrow('Operation "deny" is not permitted');
    expect(() => access.query(atom)).toThrow('Operation "query" is not permitted');
    expect(() => access.queryAll(atom)).toThrow('Operation "query" is not permitted');
    expect(kb.literals()).toEqual([]);
  });

  it("delegates permitted writes and preserves typed literals and evidence metadata", () => {
    const kb = new KnowledgeBase();
    const access = guard(kb).permit("assert", heldForOwner).permit("deny", heldForOwner);
    const atom = heldForOwner({ company: "Harbor", owner: "Oriole" });
    const metadata = { source: "deed", scores: { probability: 0.95 } };
    const positive = access.asserts(atom, metadata);
    const negative = access.denies(atom);

    expect(positive).toEqual({ sign: "+", atom, metadata });
    expect(negative).toEqual({ sign: "-", atom });
    expect(kb.literals()[0]).toBe(positive);
    expect(kb.literals()[1]).toBe(negative);
    expect(positive.atom.fields.company).toBe("Harbor");
    expect(() => access.query(atom)).toThrow('Operation "query" is not permitted');
  });

  it("enforces blocks on writes while independent views share live KB state", () => {
    const writer = guard(new KnowledgeBase()).permit("assert", heldForOwner);
    const reader = writer
      .block("assert", heldForOwner)
      .permit("assert", heldForOwner)
      .permit("query", heldForOwner);
    const atom = heldForOwner({ company: "Harbor", owner: "Oriole" });

    expect(reader.query(atom).value).toBe("unknown");
    expect(() => reader.asserts(atom)).toThrow('Operation "assert" is not permitted');
    writer.asserts(atom);
    expect(reader.query(atom).value).toBe("true");
    expect(writer.kb.literals()).toHaveLength(1);
  });

  it("does not authorize writes to another predicate with the same name", () => {
    const sameName = predicate("held_for_owner", { company: String, owner: String });
    const access = guard(new KnowledgeBase()).permit("assert", heldForOwner);
    expect(() => access.asserts(sameName({ company: "Harbor", owner: "Oriole" }))).toThrow(
      'Operation "assert" is not permitted',
    );
    expect(access.kb.literals()).toEqual([]);
  });

  it("permits a query head without requiring query access to its supporting predicates", () => {
    const kb = new KnowledgeBase();
    const atom = inForce({ company: "Harbor" });
    kb.rule(atom).iff(heldForOwner({ company: "Harbor", owner: "Oriole" }));
    kb.asserts(heldForOwner({ company: "Harbor", owner: "Oriole" }));
    const access = guard(kb).permit("query", inForce).block("query", heldForOwner);

    expect(access.query(atom)).toEqual(query(kb, atom));
    expect(access.query(atom).value).toBe("true");
    expect(() => access.query(heldForOwner({ company: "Harbor", owner: "Oriole" }))).toThrow(
      'Operation "query" is not permitted',
    );
  });

  describe("fork", () => {
    const harbor = heldForOwner({ company: "Harbor", owner: "Oriole" });

    it("keeps permissions over a copy of the KB's current contents", () => {
      const kb = new KnowledgeBase();
      kb.asserts(harbor);
      const access = example(kb);
      const fork = access.fork();

      expect(fork.kb).not.toBe(kb);
      expect(fork.kb.literals()).toEqual(kb.literals());
      expect(fork.resolve()).toEqual(access.resolve());
      expect(() => fork.denies(inForce({ company: "Harbor" }))).toThrow(
        'Operation "deny" is not permitted',
      );
    });

    it("isolates later writes in both directions", () => {
      const access = guard(new KnowledgeBase()).permit("assert", heldForOwner);
      const fork = access.fork();

      fork.asserts(harbor);
      expect(access.kb.literals()).toEqual([]);
      access.asserts(heldForOwner({ company: "Harbor", owner: "Alder" }));
      expect(fork.kb.literals()).toEqual([{ sign: "+", atom: harbor }]);
    });

    it("keeps permission edits independent", () => {
      const access = guard(new KnowledgeBase()).permit("query", heldForOwner);
      const fork = access.fork().permit("assert", heldForOwner);

      expect(access.resolve("assert")).toEqual([]);
      expect(fork.resolve("assert")).toEqual([{ operation: "assert", predicate: heldForOwner }]);
    });

    it("resolves wildcards against each KB separately", () => {
      const access = guard(new KnowledgeBase()).permit("assert", "*");
      const fork = access.fork();

      fork.asserts(harbor);
      expect(fork.resolve()).toEqual([{ operation: "assert", predicate: heldForOwner }]);
      expect(access.resolve()).toEqual([]);
    });
  });

  describe("wildcards", () => {
    const harbor = heldForOwner({ company: "Harbor", owner: "Oriole" });

    function referencing(...atoms: Parameters<KnowledgeBase["asserts"]>[0][]) {
      const kb = new KnowledgeBase();
      for (const atom of atoms) {
        kb.asserts(atom);
      }
      return kb;
    }

    it("treats permit('*') as shorthand for permit('*', '*')", () => {
      const kb = referencing(harbor, inForce({ company: "Harbor" }));

      expect(guard(kb).permit("*").resolve()).toEqual(guard(kb).permit("*", "*").resolve());
      expect(guard(kb).block("*").resolve()).toEqual(guard(kb).block("*", "*").resolve());
    });

    it("expands every operation in order, then predicates in KB discovery order", () => {
      const kb = referencing(harbor, inForce({ company: "Harbor" }));

      expect(guard(kb).permit("*").resolve()).toEqual([
        { operation: "assert", predicate: heldForOwner },
        { operation: "assert", predicate: inForce },
        { operation: "deny", predicate: heldForOwner },
        { operation: "deny", predicate: inForce },
        { operation: "query", predicate: heldForOwner },
        { operation: "query", predicate: inForce },
      ]);
    });

    it("scopes an operation wildcard to explicit predicates without consulting the KB", () => {
      const access = guard(new KnowledgeBase()).permit("*", heldForOwner);

      expect(access.resolve()).toEqual([
        { operation: "assert", predicate: heldForOwner },
        { operation: "deny", predicate: heldForOwner },
        { operation: "query", predicate: heldForOwner },
      ]);
    });

    it("scopes a predicate wildcard to one operation", () => {
      const access = guard(referencing(harbor)).permit("query", "*");

      expect(access.resolve()).toEqual([{ operation: "query", predicate: heldForOwner }]);
      expect(access.query(harbor).value).toBe("true");
      expect(() => access.asserts(harbor)).toThrow('Operation "assert" is not permitted');
    });

    it("resolves only predicates the KB references, re-evaluated on every read", () => {
      const kb = new KnowledgeBase();
      const access = guard(kb).permit("assert", "*");

      expect(access.resolve()).toEqual([]);
      kb.asserts(harbor);
      expect(access.resolve()).toEqual([{ operation: "assert", predicate: heldForOwner }]);
      kb.rule(inForce({ company: "Harbor" })).iff(harbor);
      expect(access.resolve()).toEqual([
        { operation: "assert", predicate: heldForOwner },
        { operation: "assert", predicate: inForce },
      ]);
    });

    it("lists a predicate referenced only in a rule body", () => {
      const kb = new KnowledgeBase();
      kb.rule(inForce({ company: "Harbor" })).iff(harbor);

      expect(guard(kb).permit("query", "*").resolve(heldForOwner)).toEqual([
        { operation: "query", predicate: heldForOwner },
      ]);
    });

    it("permits checks for predicates declared after the grant and never referenced", () => {
      const kb = new KnowledgeBase();
      const access = guard(kb).permit("*");
      const beneficialOwner = predicate("beneficial_owner", { company: String, owner: String });
      const atom = beneficialOwner({ company: "Harbor", owner: "Oriole" });

      expect(access.resolve(beneficialOwner)).toEqual([]);
      access.asserts(atom);
      expect(kb.literals()).toHaveLength(1);
      expect(access.resolve(beneficialOwner)).toHaveLength(3);
      expect(access.query(atom).value).toBe("true");
    });

    it("lets specific blocks carve predicates out of a wildcard permit", () => {
      const kb = referencing(harbor, inForce({ company: "Harbor" }));
      const reviewer = guard(kb).permit("*").block("deny", inForce);

      expect(reviewer.resolve("deny")).toEqual([{ operation: "deny", predicate: heldForOwner }]);
      expect(() => reviewer.denies(inForce({ company: "Harbor" }))).toThrow(
        'Operation "deny" is not permitted',
      );
      expect(reviewer.resolve("assert")).toHaveLength(2);
    });

    it("lets wildcard blocks override specific permits regardless of order", () => {
      const kb = new KnowledgeBase();
      const late = guard(kb).permit("assert", heldForOwner).block("assert", "*");
      const early = guard(kb).block("assert", "*").permit("assert", heldForOwner);

      for (const access of [late, early]) {
        expect(access.resolve()).toEqual([]);
        expect(() => access.asserts(harbor)).toThrow('Operation "assert" is not permitted');
      }
      expect(kb.literals()).toEqual([]);
    });

    it("blocks predicates declared after a wildcard block", () => {
      const access = guard(new KnowledgeBase()).permit("*").block("deny", "*");
      const beneficialOwner = predicate("beneficial_owner", { company: String, owner: String });
      const atom = beneficialOwner({ company: "Harbor", owner: "Oriole" });

      expect(() => access.denies(atom)).toThrow('Operation "deny" is not permitted');
      access.asserts(atom);
      expect(access.resolve("deny")).toEqual([]);
    });

    it("keeps block('*') from leaking into other views", () => {
      const open = guard(referencing(harbor)).permit("*");
      const closed = open.block("*");

      expect(closed.resolve()).toEqual([]);
      expect(open.resolve()).toHaveLength(3);
    });
  });

  it("guards pattern queries and retains core bindings and judgments", () => {
    const kb = new KnowledgeBase();
    kb.asserts(heldForOwner({ company: "Harbor", owner: "Oriole" }));
    kb.asserts(heldForOwner({ company: "Harbor", owner: "Alder" }));
    const Owner = variable("Owner");
    const pattern = heldForOwner({ company: "Harbor", owner: Owner });
    const access = guard(kb).permit("query", heldForOwner);

    expect(access.queryAll(pattern)).toEqual(queryAll(kb, pattern));
    expect(() => access.block("query", heldForOwner).queryAll(pattern)).toThrow(
      'Operation "query" is not permitted',
    );
  });
});
