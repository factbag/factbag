import { afterEach, describe, expect, it, vi } from "vitest";
import { predicate } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { Corpus } from "factbag/corpus";
import { classifier, createConfig, resolver } from "./index";

afterEach(() => vi.unstubAllEnvs());

const valid = predicate("valid", {}, { description: "The record is valid." });

function setup() {
  const kb = new KnowledgeBase();
  const corpus = new Corpus();
  corpus.add({ documentId: "record", text: "The record is valid." });
  return { kb, corpus };
}

describe("jev", () => {
  it("builds no default client until a job runs", async () => {
    // Arrange
    vi.stubEnv("TYPESAFE_API_KEY", undefined);
    const { kb, corpus } = setup();
    kb.asserts(valid({}));

    // Act
    const config = createConfig();
    const classifications = classifier({ corpus, input: kb, config });
    const resolutions = resolver(corpus, kb, config);
    const [job] = classifications;

    // Assert
    expect([...resolutions]).toEqual([]);
    await expect(job?.execute()).rejects.toThrow(/TYPESAFE_API_KEY|API key/iu);
  });

  it.each([1, 64, 500])("accepts a batch size of %d, since TypeSafe sets no limit", (batchSize) => {
    // Arrange: the batch size comes from the table.

    // Act
    const config = createConfig({ batchSize });

    // Assert
    expect(config.batchSize).toBe(batchSize);
  });

  it("defaults to 64 questions per request", () => {
    // Arrange: nothing to configure.

    // Act
    const config = createConfig();

    // Assert
    expect(config.batchSize).toBe(64);
  });

  it.each([0, 1.5, Infinity])("rejects a batch size of %d", (batchSize) => {
    // Arrange: the batch size comes from the table.

    // Act
    const create = () => createConfig({ batchSize });

    // Assert
    expect(create).toThrow(/batchSize/u);
  });
});
