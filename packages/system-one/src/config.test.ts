import { describe, expect, it } from "vitest";
import { KnowledgeBase } from "factbag/kb";
import { Corpus } from "factbag/corpus";
import { systemOne } from "./system-one";
import { classifier, createConfig, mockClient, resolver, testProvider } from "./testing/provider";

describe("createConfig", () => {
  it("captures raw options and reuses factory output without renormalizing", () => {
    // Arrange
    const client = mockClient(() => ({}));
    const options = { client, minimumProbability: 0.7, ambiguityMargin: 0.1 };

    // Act
    const config = createConfig(options);
    options.minimumProbability = 0.9;
    const reused = createConfig(config);

    // Assert
    expect(reused).toBe(config);
    expect(reused.minimumProbability).toBe(0.7);
    expect(reused.ambiguityMargin).toBe(0.1);
    expect(reused.client).toBe(client);
  });

  it("defaults the batch size to the provider's choice", () => {
    // Arrange
    const provider = systemOne(testProvider({ maxBatchSize: 64, defaultBatchSize: 32 }));

    // Act
    const config = provider.createConfig();

    // Assert
    expect(config.batchSize).toBe(32);
  });

  it("allows both workflows to reuse a config before any transport can be built", () => {
    // Arrange: the test provider throws if it connects without a client.
    const corpus = new Corpus();
    const kb = new KnowledgeBase();

    // Act
    const config = createConfig();
    const classifications = classifier({ corpus, input: kb, config });
    const resolutions = resolver(corpus, kb, config);

    // Assert
    expect([...classifications]).toEqual([]);
    expect([...resolutions]).toEqual([]);
    expect(classifications.kb).not.toBe(kb);
    expect(resolutions.kb).not.toBe(kb);
  });

  it.each(
    [
      { minimumProbability: 0 },
      { minimumProbability: 1.1 },
      { ambiguityMargin: -1 },
      { ambiguityMargin: Number.NaN },
      { predicateThreshold: Number.NaN },
      { predicateThreshold: Infinity },
      { predicateThreshold: -0.1 },
      { predicateThreshold: 1.1 },
      { symbolThreshold: Number.NaN },
      { symbolThreshold: Infinity },
      { symbolThreshold: -0.1 },
      { symbolThreshold: 1.1 },
      { candidateProductCutoff: -1 },
      { candidateProductCutoff: 0.5 },
      { candidateProductCutoff: Infinity },
      { candidateProductCutoff: Number.MAX_SAFE_INTEGER + 1 },
      { batchSize: 0 },
      { batchSize: 2.5 },
      { batchSize: Infinity },
      { batchSize: Number.NaN },
    ].flatMap((setting) => [true, false].map((routing) => ({ ...setting, routing }))),
  )("rejects invalid setting %j whether or not routing is on", (config) => {
    // Arrange: the invalid setting comes from the table.

    // Act
    const create = () => createConfig(config);

    // Assert
    expect(create).toThrow();
  });

  it("rejects a batch size above the provider's limit in every entry point", () => {
    // Arrange
    const provider = systemOne(testProvider({ maxBatchSize: 64 }));
    const config = { batchSize: 65 };
    const corpus = new Corpus();
    const kb = new KnowledgeBase();

    // Act
    const entries = [
      () => provider.createConfig(config),
      () => provider.classifier({ corpus, input: kb, config }),
      () => provider.resolver(corpus, kb, config),
    ];

    // Assert
    for (const entry of entries) {
      expect(entry).toThrow("batchSize must be an integer from 1 to 64 for test, received 65");
    }
  });
});

describe("systemOne", () => {
  it.each([
    { maxBatchSize: 0, defaultBatchSize: 1 },
    { maxBatchSize: 1.5, defaultBatchSize: 1 },
    { maxBatchSize: Number.NaN, defaultBatchSize: 1 },
    { maxBatchSize: 64, defaultBatchSize: 65 },
    { maxBatchSize: Infinity, defaultBatchSize: Infinity },
    { maxBatchSize: 64, defaultBatchSize: 0 },
  ])("rejects a provider declaring %j", (limits) => {
    // Arrange: the provider's limits come from the table.

    // Act
    const bind = () => systemOne(testProvider(limits));

    // Assert
    expect(bind).toThrow();
  });
});
