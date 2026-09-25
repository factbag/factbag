import { describe, expect, it } from "vitest";
import { query } from "@factbag/core/query";
import createJ1Scenario from "@factbag/scenarios/j1";
import createOfacScenario from "@factbag/scenarios/ofac";
import createHaystackScenario from "@factbag/scenarios/haystack";
import type { Scenario } from "./types";

function checkExpectations(scenario: Scenario) {
  const reference = scenario.kb.fork();
  const originalCount = scenario.kb.literals().length;
  for (const document of scenario.corpus.documents()) {
    const { evidence, irrelevantTo } = document.metadata;
    expect(evidence).toBeDefined();
    expect(irrelevantTo).toBeDefined();
    // Each fixture is fully labeled for this scenario's explicit targets.
    for (const target of scenario.targets) {
      const labeled = evidence?.some(({ atom }) => atom === target) ?? false;
      expect(labeled || irrelevantTo?.includes(target)).toBe(true);
      expect(labeled && irrelevantTo?.includes(target)).toBe(false);
    }
    for (const literal of evidence ?? []) {
      if (literal.sign === "+") {
        reference.asserts(literal.atom);
      } else {
        reference.denies(literal.atom);
      }
    }
  }
  for (const { atom, value } of scenario.expected) {
    expect(query(reference, atom).value).toBe(value);
  }
  expect(scenario.kb.literals()).toHaveLength(originalCount);
}

describe("scenario factories", () => {
  it.each(["positive", "negative", "contradictory", "contradictory-document", "neutral"] as const)(
    "J-1 %s has consistent extraction and reasoning expectations",
    (caseName) => {
      const scenario = createJ1Scenario(caseName);
      expect(scenario.kb.literals()).toEqual([]);
      expect(
        query(scenario.kb, scenario.predicates.tenureTrack({ person: scenario.applicant })).value,
      ).toBe("unknown");
      checkExpectations(scenario);
    },
  );

  it("supports both signs for one target in one document", () => {
    const scenario = createJ1Scenario("contradictory-document");
    const evidence = scenario.corpus
      .filter(({ metadata }) => metadata.kind === "evidence")
      .documents();
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.metadata.evidence?.map(({ sign }) => sign)).toEqual(["+", "-"]);
    expect(evidence[0]?.metadata.evidence?.every(({ atom }) => atom === scenario.targets[0])).toBe(
      true,
    );
  });

  it("preserves native predicate and entity linkage through views and provenance resolution", () => {
    const { corpus, predicates, applicant, targets } = createJ1Scenario();
    const view = corpus.filter(
      ({ metadata }) =>
        metadata.evidence?.some(({ atom }) => atom.predicate === predicates.tenureTrack) ?? false,
    );
    expect(view.documents()).toHaveLength(1);
    const [document] = view.documents();
    if (document === undefined) {
      throw new Error("Expected evidence document");
    }
    const [literal] = document.metadata.evidence ?? [];
    expect(literal?.atom).toBe(targets[0]);
    expect(literal?.atom.predicate).toBe(predicates.tenureTrack);
    expect(literal?.atom.fields["person"]).toBe(applicant);
    const source = view.slice(document, { start: 0, end: 10 }).id;
    expect(view.resolve(source).document.metadata.evidence?.[0]).toBe(literal);
    expect(Object.isFrozen(applicant)).toBe(false);
  });

  it("returns independent KBs, corpora, predicates and entities on every call", () => {
    const a = createJ1Scenario();
    const b = createJ1Scenario();
    expect(a.predicates.tenureTrack).not.toBe(b.predicates.tenureTrack);
    expect(a.applicant).not.toBe(b.applicant);
    a.kb.asserts(a.predicates.tenureTrack({ person: a.applicant }));
    a.corpus.add({ documentId: "extra", text: "Extra document" });
    expect(b.kb.literals()).toEqual([]);
    expect(() => b.corpus.document("extra")).toThrow("Unknown document");
    expect(a.corpus.document("shared/printer-maintenance").metadata.irrelevantTo?.[0]).toBe(
      a.targets[0],
    );
    expect(b.corpus.document("shared/printer-maintenance").metadata.irrelevantTo?.[0]).toBe(
      b.targets[0],
    );
  });

  it("OFAC's imported evidence proves the ownership chain and prohibition", () => {
    const scenario = createOfacScenario();
    expect(scenario.kb.literals()).toHaveLength(1);
    expect(scenario.corpus.documents()).toHaveLength(8);
    expect(
      query(
        scenario.kb,
        scenario.predicates.prohibited({ transaction: scenario.entities.transaction }),
      ).value,
    ).toBe("unknown");
    checkExpectations(scenario);
    expect(
      scenario.corpus.filter(({ metadata }) => metadata.kind === "near-miss").documents(),
    ).toHaveLength(3);
  });

  it("renders OFAC entity names and effective dates from the same scenario context", () => {
    const scenario = createOfacScenario();
    const listing = scenario.corpus.document("ofac/sdn-listing");
    const ownership = scenario.corpus.document("ofac/share-certificate");
    expect(listing.text).toContain(scenario.entities.volkov.fullName);
    expect(listing.text).toContain("Designated 2022-03-20");
    expect(listing.text).toContain("Last Updated: 2025-01-15");
    expect(ownership.text).toContain(scenario.entities.ural.fullName);
    expect(ownership.text).toContain("Date of issue: 2021-04-15");
    expect(scenario.predicates.sanctioned.metadata?.description).toContain("2025-01-20");
    expect(scenario.predicates.ownsMajority.metadata?.description).toContain("2025-01-20");
    expect(scenario.corpus.documents().every(({ text }) => !text.includes("{{"))).toBe(true);
    checkExpectations(scenario);
  });

  it("stretches the ownership chain and buries it in unrelated paperwork", () => {
    const scenario = createHaystackScenario();
    const ofac = createOfacScenario();

    expect(scenario.corpus.documents().length).toBeGreaterThan(30);
    // Seven ownership links, each needing its own evidence, against OFAC's single edge.
    const ownership = scenario.targets.filter(
      ({ predicate }) => predicate === scenario.predicates.ownsMajority,
    );
    expect(ownership).toHaveLength(7);
    expect(scenario.expected.every(({ value }) => value === "true")).toBe(true);
    // Wider candidate domains: the chain and the noise add parties, transactions and industries.
    expect(scenario.kb.entities.all().length).toBeGreaterThan(ofac.kb.entities.all().length);
    // Long documents exist to exercise chunking.
    expect(Math.max(...scenario.corpus.documents().map(({ text }) => text.length))).toBeGreaterThan(
      12_000,
    );
    // The noise is background: it never mentions the question, and carries no evidence.
    for (const document of scenario.corpus
      .filter(({ documentId }) => documentId.startsWith("haystack/company-"))
      .documents()) {
      expect(document.metadata.evidence).toEqual([]);
      expect(document.text).not.toMatch(/sanction|designat|blocked|prohibit/iu);
    }
    checkExpectations(scenario);
  });
});
