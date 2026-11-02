import { describe, expect, it } from "vitest";
import { predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { normalize } from "../config";
import type { Settings } from "../config";
import { relevanceModel } from "../testing/fake-model";
import { testProvider } from "../testing/provider";
import type { Subject } from "../types/model";
import { classifiablePredicates } from "./classifiable-predicates";
import { filterPredicates } from "./filter-predicates";

const paid = predicate("paid", {}, { description: "The invoice was paid." });
const signed = predicate("signed", {}, { description: "The contract was signed." });
const shipped = predicate("shipped", {}, { description: "The order was shipped." });

/** Filter the three predicates, scoring each by name. */
async function filter(scores: Readonly<Record<string, number>>, config: Settings) {
  const corpus = new Corpus();
  const text = "The invoice was paid and the order shipped.";
  corpus.add({ documentId: "record", text });
  const score = (subject: Subject) =>
    "declaration" in subject ? (scores[subject.declaration.name] ?? 0) : 0;
  const retained = await filterPredicates({
    chunk: corpus.slice({ documentId: "record" }, { start: 0, end: text.length }),
    predicates: classifiablePredicates(
      guard(new KnowledgeBase()).permit("assert", paid, signed, shipped),
    ),
    config: { ...normalize(testProvider(), config), model: relevanceModel(score) },
  });
  return retained.map(({ declaration }) => declaration);
}

describe("filterPredicates", () => {
  it("keeps every predicate when routing is off, however the model would score them", async () => {
    // Arrange
    const scores = {};

    // Act
    const retained = await filter(scores, { routing: false });

    // Assert
    expect(retained).toEqual([paid, signed, shipped]);
  });

  it("keeps predicates scored at or above the threshold, in input order", async () => {
    // Arrange
    const scores = { paid: 0.3, signed: 0.29, shipped: 1 };

    // Act
    const retained = await filter(scores, { routing: true, predicateThreshold: 0.3 });

    // Assert
    expect(retained).toEqual([paid, shipped]);
  });
});
