import { afterEach, describe, expect, it, vi } from "vitest";
import { predicate } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { Corpus } from "factbag/corpus";
import { classifier, createConfig } from "./index";
import type { Config } from "./index";

afterEach(() => vi.unstubAllEnvs());

const valid = predicate("valid", {}, { description: "The record is valid." });

/** Clef's answer to every question in `inputs`: a confident assertion. */
function output(inputs: Record<string, unknown>) {
  const questions = inputs["questions"];
  return {
    model: "clef-flash",
    usage: { input_tokens: 10, output_tokens: 0 },
    answers: Object.fromEntries(
      Object.keys(typeof questions === "object" && questions !== null ? questions : {}).map(
        (id) => [
          id,
          {
            type: "choice",
            choice: "ASSERT",
            confidence: 0.9,
            probabilities: { ASSERT: 0.9, DENY: 0.05, IRRELEVANT: 0.05 },
          },
        ],
      ),
    ),
  };
}

/** Classify "The record is valid." for `valid`, returning the run's new evidence. */
async function classify(config: Config) {
  const kb = new KnowledgeBase();
  kb.asserts(valid({}));
  const corpus = new Corpus();
  corpus.add({ documentId: "record", text: "The record is valid." });
  const run = classifier({ corpus, input: kb, config });
  await Promise.all([...run].map(async (job) => await job.execute()));
  return run.kb.literals().filter(({ metadata }) => metadata?.source !== undefined);
}

/** The JSON object a request sent. */
function sent(init: RequestInit | undefined): Record<string, unknown> {
  const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Expected a JSON object body");
  }
  return Object.fromEntries(Object.entries(body));
}

/** A REST endpoint answering with `respond`, recording each request. */
function restFetch(respond: (body: Record<string, unknown>) => Response) {
  return vi.fn<typeof fetch>(async (_url, init) => await Promise.resolve(respond(sent(init))));
}

describe("clef", () => {
  it("runs Clef-flash through a Workers AI binding and annotates evidence under clef", async () => {
    // Arrange
    const run = vi.fn(
      async (_model: string, inputs: Record<string, unknown>) =>
        await Promise.resolve(output(inputs)),
    );

    // Act
    const evidence = await classify({ binding: { run } });

    // Assert
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]?.[0]).toBe("@cf/cloudflare/clef-flash");
    expect(run.mock.calls[0]?.[1]).toMatchObject({
      model: "clef-flash",
      state: { document: { text: "The record is valid." } },
    });
    expect(
      evidence.map(({ sign, metadata }) => [sign, Object.keys(metadata?.annotations ?? {})]),
    ).toEqual([["+", ["clef"]]]);
  });

  it("posts to the account's REST endpoint and unwraps Cloudflare's envelope", async () => {
    // Arrange
    const fetch = restFetch((body) =>
      Response.json({ result: output(body), success: true, errors: [], messages: [] }),
    );

    // Act
    const evidence = await classify({ model: "clef", accountId: "acct", apiToken: "token", fetch });

    // Assert
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/cloudflare/clef",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token");
    expect(sent(init)).toMatchObject({ model: "clef" });
    expect(evidence).toHaveLength(1);
  });

  it("reads REST credentials from the environment only when a job runs", async () => {
    // Arrange
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "env-acct");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "env-token");
    const fetch = restFetch((body) => Response.json({ result: output(body), success: true }));

    // Act
    await classify({ fetch });

    // Assert
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/env-acct/ai/run/@cf/cloudflare/clef-flash",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer env-token");
  });

  it.each([
    {
      name: "missing credentials",
      config: {},
      error: /CLOUDFLARE_ACCOUNT_ID is not set/u,
    },
    {
      name: "an HTTP error",
      config: {
        accountId: "acct",
        apiToken: "token",
        fetch: restFetch(() => new Response("bad token", { status: 401 })),
      },
      error: /rejected a clef-flash request with 401: bad token/u,
    },
    {
      name: "an unsuccessful envelope",
      config: {
        accountId: "acct",
        apiToken: "token",
        fetch: restFetch(() => Response.json({ success: false, errors: [{ code: 5006 }] })),
      },
      error: /Workers AI request failed: \[\{"code":5006\}\]/u,
    },
    {
      name: "an unknown model",
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JavaScript callers can pass any string.
      config: { model: "clef-xl" as NonNullable<Config["model"]>, binding: { run: vi.fn() } },
      error: /model must be one of clef, clef-flash/u,
    },
  ])("rejects a job on $name", async ({ config, error }) => {
    // Arrange
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", undefined);
    vi.stubEnv("CLOUDFLARE_API_TOKEN", undefined);

    // Act
    const classified = classify(config);

    // Assert
    await expect(classified).rejects.toThrow(error);
  });

  it("defaults to, and caps, a batch at Workers AI's 64 questions", () => {
    // Arrange: nothing to configure.

    // Act
    const config = createConfig();
    const tooLarge = () => createConfig({ batchSize: 65 });

    // Assert
    expect(config.batchSize).toBe(64);
    expect(tooLarge).toThrow("batchSize must be an integer from 1 to 64 for clef, received 65");
  });
});
