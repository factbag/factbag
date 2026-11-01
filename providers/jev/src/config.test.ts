import { afterEach, describe, expect, it, vi } from "vitest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { createConfig } from "./config";
import { classifier } from "./classifier/classifier";
import { resolver } from "./resolve";

afterEach(() => vi.unstubAllEnvs());

describe("createConfig", () => {
  it("captures raw options and reuses factory output without renormalizing", () => {
    // Arrange
    const client = new TypeSafeClient({ apiKey: "test" });
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

  it("allows both workflows to reuse a default config before credentials are available", () => {
    // Arrange
    vi.stubEnv("TYPESAFE_API_KEY", undefined);
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
    ].flatMap((setting) => [true, false].map((routing) => ({ ...setting, routing }))),
  )("rejects invalid setting %j whether or not routing is on", (config) => {
    // Arrange: the invalid setting comes from the table.

    // Act
    const create = () => createConfig(config);

    // Assert
    expect(create).toThrow();
  });
});
