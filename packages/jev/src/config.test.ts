import { afterEach, describe, expect, it, vi } from "vitest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { createConfig } from "./config";
import { classifier } from "./classifier";
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

  it.each([
    { minimumProbability: 0 },
    { minimumProbability: 1.1 },
    { ambiguityMargin: -1 },
    { ambiguityMargin: Number.NaN },
  ])("rejects invalid setting %j", (config) => {
    // Arrange: the invalid setting comes from the table.

    // Act
    const create = () => createConfig(config);

    // Assert
    expect(create).toThrow();
  });
});
