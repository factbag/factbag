import { describe, expect, it, vi } from "vitest";
import { predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "./classifier";
import type { ClassifierClient } from "./classifier";

describe("classifier", () => {
  it("returns chunk plans only when routing is enabled", () => {
    // Arrange
    const corpus = new Corpus();
    corpus.add({ documentId: "record", text: "The record is valid." });
    const valid = predicate("valid", {}, { description: "The record is valid." });
    const access = guard(new KnowledgeBase()).permit("assert", valid);

    // Act
    const run = classifier(corpus, access, { routing: {} });
    const [chunk] = [...run];

    // Assert
    expect(chunk?.relevance).toHaveLength(1);
    expect(chunk?.inspect()).toMatchObject({
      relevance: { requests: 0, questions: 0 },
      classification: { requests: 0, questions: 0 },
    });
  });

  it("produces the same exhaustive jobs and facts with routing absent or disabled", async () => {
    // Arrange
    const kb = new KnowledgeBase();
    const corpus = new Corpus();
    corpus.add({ documentId: "record", text: "The record is valid." });
    const valid = predicate("valid", { value: Boolean }, { description: "The validity status." });
    const access = guard(kb).permit("assert", valid).permit("deny", valid);
    const client: ClassifierClient = {
      systemOne: vi.fn<ClassifierClient["systemOne"]>(
        async ({ questions }) =>
          await Promise.resolve({
            model: "test",
            usage: { input_tokens: null, output_tokens: null },
            answers: Object.fromEntries(
              Object.keys(questions).map((id) => [
                id,
                {
                  type: "choice" as const,
                  choice: "ASSERT" as const,
                  confidence: 1,
                  probabilities: { ASSERT: 1, DENY: 0, IRRELEVANT: 0 },
                },
              ]),
            ),
          }),
      ),
    };

    // Act
    const exhaustive = classifier(corpus, access, { client });
    const disabled = classifier(corpus, access, { client, routing: false });
    const execute = async (run: typeof exhaustive) =>
      await Promise.all(
        [...run].map(async (job) => ({
          source: job.source,
          predicate: job.predicate,
          result: await job.execute(),
        })),
      );
    const expected = await execute(exhaustive);
    const actual = await execute(disabled);

    // Assert
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(1);
    expect(actual[0]?.result.assessments.map(({ atom }) => atom.fields)).toEqual([
      { value: false },
      { value: true },
    ]);
    expect(disabled.kb.literals()).toEqual(exhaustive.kb.literals());
    expect(disabled.kb.literals().map(({ sign }) => sign)).toEqual(["+", "+"]);
    expect(kb.literals()).toEqual([]);
  });
});
