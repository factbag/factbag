/**
 * The benchmark's exclusivity as a derived violation, and the recheck resolver on a story
 * where the classifier read a grandparent as a parent too: the spurious fact falls, the
 * stated one and the rest of the passage stay, and the question is answered.
 */
import { describe, expect, it, vi } from "vitest";
import { variable } from "@factbag/core/dsl";
import { query, queryAll } from "@factbag/core/query";
import { Corpus } from "@factbag/corpus";
import { recheck } from "@factbag/jev/recheck";
import type { RecheckClient } from "@factbag/jev/recheck";
import { answer } from "./answer";
import { kinshipKB } from "./kinship";
import { gender, grandparent_of, parent_of, Person, spouse_of } from "./schema";
import {
  conflicting_relations,
  defineViolations,
  stated_twice,
  violationQueries,
} from "./violations";

const A = variable("A");
const B = variable("B");

const TEXT =
  "James's wife, Sandra, was eager to plan a party for Jeanna, James's daughter. Molly, Jeanna's grandmother, had great ideas.";

/** The story's people, the rules, the constraint, and one passage holding the whole text. */
function setup() {
  const kb = kinshipKB();
  defineViolations(kb);
  const people = new Map(
    ["James", "Sandra", "Jeanna", "Molly"].map((name) => [name, new Person(name)]),
  );
  kb.entities.add(...people.values());
  const corpus = new Corpus();
  corpus.add({ documentId: "text", text: TEXT });
  const source = `text#0-${String(TEXT.length)}`;
  const p = (name: string): Person => {
    const person = people.get(name);
    if (person === undefined) {
      throw new Error(name);
    }
    return person;
  };
  const stated = [
    kb.asserts(spouse_of({ a: p("James"), b: p("Sandra") }), {
      source,
      scores: { probability: 1 },
    }),
    kb.asserts(parent_of({ parent: p("James"), child: p("Jeanna") }), {
      source,
      scores: { probability: 1 },
    }),
    kb.asserts(grandparent_of({ grandparent: p("Molly"), grandchild: p("Jeanna") }), {
      source,
      scores: { probability: 1 },
    }),
    kb.asserts(gender({ person: p("Molly"), gender: "female" }), { source }),
    kb.asserts(gender({ person: p("Sandra"), gender: "female" }), { source }),
  ];
  // The misreading: "Molly, Jeanna's grandmother" taken as a parent too.
  const spurious = kb.asserts(parent_of({ parent: p("Molly"), child: p("Jeanna") }), {
    source,
    scores: { probability: 0.47 },
  });
  return { kb, corpus, people, p, stated, spurious };
}

type Choice = "ASSERT" | "DENY" | "IRRELEVANT";

function reading(
  ASSERT: number,
  IRRELEVANT: number,
  DENY: number,
): {
  type: "choice";
  choice: Choice;
  confidence: number;
  probabilities: Record<Choice, number>;
} {
  const choice: Choice =
    ASSERT >= Math.max(DENY, IRRELEVANT) ? "ASSERT" : DENY >= IRRELEVANT ? "DENY" : "IRRELEVANT";
  return { type: "choice", choice, confidence: 0.9, probabilities: { ASSERT, DENY, IRRELEVANT } };
}

/** The candidates a recheck request carries in its state, each an id and its fields. */
function candidatesOf(state: unknown): readonly { id: string; fields: unknown }[] {
  if (typeof state !== "object" || state === null || !("candidates" in state)) {
    throw new Error("No candidates in the request");
  }
  const { candidates } = state;
  if (!Array.isArray(candidates)) {
    throw new Error("No candidates in the request");
  }
  return candidates.map((candidate: unknown) => {
    if (typeof candidate !== "object" || candidate === null || !("id" in candidate)) {
      throw new Error("A candidate without an id");
    }
    const { id } = candidate;
    const fields = "fields" in candidate ? candidate.fields : undefined;
    return { id: String(id), fields };
  });
}

/**
 * Rereads the candidates whose fields satisfy `misread` as unstated and the rest as stated.
 * The candidates come from the request's state; the ids are the recheck's own.
 */
function rereader(misread: (fields: string) => boolean) {
  return {
    systemOne: vi.fn<RecheckClient["systemOne"]>(async (request) => {
      const candidates = candidatesOf(request.state);
      return await Promise.resolve({
        model: "test",
        usage: { input_tokens: 0, output_tokens: 0 },
        answers: Object.fromEntries(
          candidates.map(({ id, fields }) => [
            id,
            misread(JSON.stringify(fields)) ? reading(0.08, 0.9, 0.02) : reading(0.97, 0.02, 0.01),
          ]),
        ),
      });
    }),
  };
}

describe("stated_twice", () => {
  it("is derived for two different relations stated between the same two people", () => {
    const { kb, p } = setup();
    expect(query(kb, stated_twice({ a: p("Molly"), b: p("Jeanna") })).value).toBe("true");
    expect(query(kb, stated_twice({ a: p("Jeanna"), b: p("Molly") })).value).toBe("true");
    expect(query(kb, stated_twice({ a: p("James"), b: p("Jeanna") })).value).toBe("false");
    expect(query(kb, stated_twice({ a: p("James"), b: p("Sandra") })).value).toBe("false");
    const pairs = queryAll(kb, stated_twice({ a: A, b: B }))
      .filter((judgment) => judgment.value === "true")
      .map((judgment) => [judgment.goal.atom.fields["a"], judgment.goal.atom.fields["b"]]);
    expect(pairs).toHaveLength(2);
  });

  it("is not derived for one relation stated in both of its names", () => {
    const { kb, p } = setup();
    kb.asserts(spouse_of({ a: p("Sandra"), b: p("James") }), { source: "text#0-1" });
    expect(query(kb, stated_twice({ a: p("James"), b: p("Sandra") })).value).toBe("false");
  });

  it("leaves the question ambiguous before resolution and answered after it", async () => {
    const { kb, corpus, people, p, stated, spurious } = setup();
    // Molly is Jeanna's grandmother; the misreading makes her Jeanna's mother as well.
    const before = answer(kb, people, "Jeanna", "Molly");
    expect(before.predicted).toBeUndefined();
    expect(before.failure).toMatch(/^several relations: /u);

    // "Molly, Jeanna's grandmother" does not make Molly Jeanna's mother; all else stands.
    const client = rereader(
      (fields) =>
        fields.includes('"parent"') && fields.includes("Molly") && fields.includes("Jeanna"),
    );
    const pair = { a: p("Jeanna"), b: p("Molly") };
    const result = await recheck(corpus, kb, violationQueries(pair), { client, maxRounds: 2 });

    expect(result.retracted).toEqual([spurious]);
    expect(result.unresolved).toEqual([]);
    expect(result.kb.literals()).toEqual(stated);
    const after = answer(result.kb, people, "Jeanna", "Molly");
    expect(after.predicted).toBe("grandmother");
    expect(after.derived).toBe(false);
    expect(after.supporting["inv-grand"]).toHaveLength(1);
  });
});

describe("conflicting_relations", () => {
  it("is derived for two different relations derived between the same two people", () => {
    const { kb, p, spurious } = setup();
    expect(query(kb, conflicting_relations({ a: p("Molly"), b: p("Jeanna") })).value).toBe("true");
    expect(query(kb, conflicting_relations({ a: p("James"), b: p("Jeanna") })).value).toBe("true");
    // Without the misreading the queried pair is settled: Molly is Jeanna's grandmother. The
    // relations are `if` rules, so what they do not derive is unknown rather than false.
    kb.retract(spurious);
    expect(query(kb, conflicting_relations({ a: p("Molly"), b: p("Jeanna") })).value).not.toBe(
      "true",
    );
  });

  it("fires on a consistent family under the benchmark's own rules, so it is asked per pair", () => {
    // Molly is Jeanna's grandmother; the rules make her James's parent (his child's
    // grandparent) and also James's parent-in-law (his spouse's child's grandparent). Both
    // compositions are the benchmark's; the facts are all true. Asked for every pair, the
    // constraint would send this story's gold facts back for rereading.
    const { kb, p, spurious } = setup();
    kb.retract(spurious);
    expect(query(kb, conflicting_relations({ a: p("Molly"), b: p("James") })).value).toBe("true");
    const everywhere = queryAll(kb, conflicting_relations({ a: A, b: B })).filter(
      (judgment) => judgment.value === "true",
    );
    expect(everywhere.length).toBeGreaterThan(0);
    expect(violationQueries()).toHaveLength(1);
    expect(violationQueries({ a: p("Jeanna"), b: p("Molly") })).toHaveLength(2);
  });

  it("catches a spurious fact that shares no pair with a stated one", async () => {
    // Gregory is Sarah's son and Christopher's father. The misreading makes Sarah
    // Christopher's parent as well, so she is both his parent and his grandparent, though no
    // pair is stated twice.
    const kb = kinshipKB();
    defineViolations(kb);
    const people = new Map(
      ["Sarah", "Gregory", "Christopher"].map((name) => [name, new Person(name)]),
    );
    kb.entities.add(...people.values());
    const text =
      "Gregory went to the beach with his mother Sarah and his son Christopher. Sarah brought the sandwiches.";
    const corpus = new Corpus();
    corpus.add({ documentId: "text", text });
    const source = `text#0-${String(text.length)}`;
    const p = (name: string): Person => {
      const person = people.get(name);
      if (person === undefined) {
        throw new Error(name);
      }
      return person;
    };
    const stated = [
      kb.asserts(parent_of({ parent: p("Sarah"), child: p("Gregory") }), {
        source,
        scores: { probability: 1 },
      }),
      kb.asserts(parent_of({ parent: p("Gregory"), child: p("Christopher") }), {
        source,
        scores: { probability: 1 },
      }),
      kb.asserts(gender({ person: p("Sarah"), gender: "female" }), { source }),
    ];
    const spurious = kb.asserts(parent_of({ parent: p("Sarah"), child: p("Christopher") }), {
      source,
      scores: { probability: 0.45 },
    });
    expect(queryAll(kb, stated_twice({ a: A, b: B })).filter((j) => j.value === "true")).toEqual(
      [],
    );
    expect(query(kb, conflicting_relations({ a: p("Sarah"), b: p("Christopher") })).value).toBe(
      "true",
    );
    expect(answer(kb, people, "Christopher", "Sarah").failure).toMatch(/^several relations: /u);

    // "his mother Sarah and his son Christopher" does not make Sarah Christopher's parent.
    const client = rereader(
      (fields) =>
        fields.includes('"parent"') && fields.includes("Sarah") && fields.includes("Christopher"),
    );
    // Pairs stated twice alone: nothing to reread, the question stays open.
    const untouched = await recheck(corpus, kb, violationQueries(), { client, maxRounds: 2 });
    expect(untouched.retracted).toEqual([]);
    expect(client.systemOne).not.toHaveBeenCalled();
    // The queried pair's conflict: the misreading falls, the question is answered.
    const pair = { a: p("Christopher"), b: p("Sarah") };
    const result = await recheck(corpus, kb, violationQueries(pair), { client, maxRounds: 2 });
    expect(result.retracted).toEqual([spurious]);
    expect(result.unresolved).toEqual([]);
    expect(result.kb.literals()).toEqual(stated);
    expect(answer(result.kb, people, "Christopher", "Sarah").predicted).toBe("grandmother");
  });
});
