import { describe, expect, it } from "vitest";
import { and, enumeration, not, predicate } from "@factbag/core/dsl";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { KnowledgeBase } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import { runSanctionsDemo } from "./sanctions";
import { runFactorDemo } from "./factors";
import { supportScore } from "./support-score";
import { distribution } from "./fixtures";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { mockJev } from "./mock-jev";
import { classifier } from "../src/classifier";

describe("standalone walkthrough", () => {
  it("surfaces disagreement, reviews the source, and retains the excluded evidence", async () => {
    const demo = await runSanctionsDemo();
    expect([demo.initial.value, demo.disputed.value, demo.resolved.value]).toEqual([
      "unknown",
      "conflicted",
      "true",
    ]);
    expect(demo.extractions).toBe(8);
    expect(
      demo.assessments
        .flatMap((batch) => batch.assessments)
        .filter((item) => item.literals.length === 0),
    ).toHaveLength(5);
    expect(demo.review.evidence.metadata?.scores?.["probability"]).toBe(0.98);
    expect(demo.kb.literals()).not.toContain(demo.review.evidence);
    expect(
      demo.assessments.flatMap((batch) => batch.assessments).flatMap((item) => item.literals),
    ).toContain(demo.review.evidence);
    const confirmation = demo.assessments
      .flatMap((batch) => batch.assessments)
      .flatMap((item) => item.literals)
      .find((literal) => literal.atom.predicate.name === "nominee_arrangement_in_force");
    expect(confirmation).toBeDefined();
    expect(demo.kb.literals()).toContain(confirmation);
    expect(confirmation?.metadata?.scores?.["probability"]).toBe(0.87);
    const source = demo.review.evidence.metadata?.source;
    if (source === undefined) {
      throw new Error("Missing reviewed source");
    }
    const original = demo.corpus.resolve(source);
    expect(original.document.documentId).toBe("superseded-onboarding-memo");
    expect(original.chunk.text).toContain("own account");
  });

  it("computes the numeric route examples from actual core judgments", async () => {
    const demo = await runSanctionsDemo();
    expect(supportScore(demo.disputed)).toBeNull();
    expect(demo.score).toBe(0.87);
    expect(demo.strengthenedScore).toBe(0.92);
    expect(demo.strengthened.value).toBe("true");
  });

  it("imports list membership and ownership records without assigning them model probabilities", async () => {
    const demo = await runSanctionsDemo();
    expect(demo.directlyListed.value).toBe("false");
    expect(demo.resolved.value).toBe("true");
    expect(demo.structuredEvidence).toHaveLength(3);
    for (const literal of demo.structuredEvidence) {
      expect(demo.kb.literals()).toContain(literal);
      expect(literal.metadata?.scores?.["support"]).toBe(1);
      expect(literal.metadata?.scores?.["probability"]).toBeUndefined();
      expect(literal.metadata?.annotations?.["jev"]).toBeUndefined();
      expect(literal.metadata?.annotations?.["ingestion"]).toMatchObject({
        kind: "structured",
        asOf: demo.asOf,
      });
      const source = literal.metadata?.source;
      if (source === undefined) {
        throw new Error("Missing structured provenance");
      }
      expect(demo.corpus.resolve(source).chunk.text).toContain(demo.asOf);
    }
    const assessedPredicates = demo.assessments
      .flatMap((batch) => batch.assessments)
      .flatMap((item) => item.literals)
      .map((literal) => literal.atom.predicate.name);
    expect(new Set(assessedPredicates)).toEqual(
      new Set(["nominee_holds_for_owner", "nominee_arrangement_in_force"]),
    );
  });

  it.each([
    { ownershipBasisPoints: 4999, expected: "false" },
    { ownershipBasisPoints: 5000, expected: "true" },
  ])(
    "computes the majority threshold deterministically: $ownershipBasisPoints",
    async ({ ownershipBasisPoints, expected }) => {
      const demo = await runSanctionsDemo({ ownershipBasisPoints });
      expect(demo.resolved.value).toBe(expected);
      expect(demo.strengthened.value).toBe(expected);
    },
  );

  it("keeps positive contribution, explicit non-contribution, and missing evidence distinct", async () => {
    const demo = await runFactorDemo();
    expect(
      demo.factors.map(({ factor, value, positiveSupport, negativeSupport }) => ({
        factor,
        value,
        positiveSupport,
        negativeSupport,
      })),
    ).toEqual([
      { factor: "reliability", value: "true", positiveSupport: 0.94, negativeSupport: null },
      { factor: "onboarding", value: "true", positiveSupport: 0.82, negativeSupport: null },
      { factor: "billing", value: "true", positiveSupport: 0.76, negativeSupport: null },
      { factor: "price", value: "false", positiveSupport: null, negativeSupport: 0.91 },
      { factor: "competition", value: "unknown", positiveSupport: null, negativeSupport: null },
    ]);
    expect(demo.productScore).toBe(0.82);
    expect(demo.commercialScore).toBe(0.76);
    expect(demo.score).toBe(0.82);
    expect(demo.withoutOnboardingScore).toBe(0.76);
    // Sensitivity is computed on a separate KB; the original proof remains unchanged.
    expect(supportScore(demo.conclusion)).toBe(0.82);
  });

  it("shows both sides of an ambiguous factor rather than quietly choosing the first literal", async () => {
    const demo = await runFactorDemo({ onboarding: distribution(0.49, 0.48, 0.03) });
    expect(demo.factors.find((factor) => factor.factor === "onboarding")).toMatchObject({
      value: "conflicted",
      positiveSupport: 0.49,
      negativeSupport: 0.48,
    });
    expect(demo.product.value).toBe("conflicted");
    expect(demo.productScore).toBeNull();
    expect(demo.commercialScore).toBe(0.76);
  });
});

it("rejects a mismatched candidate instead of making an incorrect demo request appear successful", async () => {
  const fact = predicate(
    "fixture_fact",
    { invoice: enumeration("B") },
    { description: "The invoice is valid." },
  );
  using mock = mockJev([
    {
      text: "Invoice A is valid.",
      predicate: fact.name,
      answers: {
        candidate_0: { fields: { invoice: "A" }, answer: distribution(0.96, 0.02, 0.02) },
      },
    },
  ]);
  const kb = new KnowledgeBase();
  const corpus = new Corpus();
  corpus.add({ documentId: "doc", text: "Invoice A is valid." });
  const run = classifier(corpus, guard(kb).permit("assert", fact), {
    client: new TypeSafeClient(mock.clientOptions),
    admission: { minimumProbability: 0.3, ambiguityMargin: 0.05 },
  });
  await expect(Promise.all([...run].map(async (job) => await job.execute()))).rejects.toThrow(
    "Candidate fields",
  );
  expect(kb.literals()).toEqual([]);
  expect(run.kb.literals()).toEqual([]);
});

describe("demo-only support policy", () => {
  const fact = predicate("fact", { name: String });

  it("uses an explicitly assigned support weight for structured facts", () => {
    const kb = new KnowledgeBase();
    const atom = fact({ name: "imported" });
    kb.asserts(atom, { scores: { support: 1 } });
    expect(supportScore(query(kb, atom))).toBe(1);
  });

  it("does not inflate support when evidence appears repeatedly", () => {
    const kb = new KnowledgeBase();
    const atom = fact({ name: "a" });
    const twice = predicate("twice", {});
    kb.asserts(atom, { scores: { probability: 0.8 } });
    kb.asserts(atom, { scores: { probability: 0.8 } });
    kb.rule(twice({})).iff(and(atom, atom));
    expect(supportScore(query(kb, twice({})))).toBe(0.8);
  });

  it("returns no score for missing weights, unknowns, denials, or unresolved conflicts", () => {
    const kb = new KnowledgeBase();
    const atom = fact({ name: "a" });
    expect(supportScore(query(kb, atom))).toBeNull();
    const unscored = kb.asserts(atom);
    expect(supportScore(query(kb, atom))).toBeNull();
    kb.retract(unscored);
    kb.denies(atom, { scores: { probability: 0.9 } });
    expect(supportScore(query(kb, atom))).toBeNull();
    kb.asserts(atom, { scores: { probability: 0.8 } });
    expect(supportScore(query(kb, atom))).toBeNull();
  });

  it("does not pretend to implement a policy for negation", () => {
    const kb = new KnowledgeBase();
    const atom = fact({ name: "a" });
    const inverse = predicate("inverse", {});
    kb.denies(atom, { scores: { probability: 0.9 } });
    kb.rule(inverse({})).iff(not(atom));
    expect(query(kb, inverse({})).value).toBe("true");
    expect(supportScore(query(kb, inverse({})))).toBeNull();
  });
});
