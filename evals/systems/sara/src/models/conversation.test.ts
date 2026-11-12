import { describe, expect, it } from "vitest";
import { Conversation, identityOf } from "./conversation";
import type { Connection } from "./conversation";
import { scripted } from "./conversation-testing";

const tool = {
  type: "function",
  function: { name: "lookup", description: "Look a word up.", parameters: {}, strict: true },
} as const;

/** A connection whose endpoint answers every request with `body`, and the requests it was sent. */
function answering(
  body: unknown,
  connection: Partial<Connection> = {},
): { connection: Connection; requests: { url: string; body: Record<string, unknown> }[] } {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The client sends JSON.
    const sent = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<
      string,
      unknown
    >;
    requests.push({ url: typeof url === "string" ? url : "", body: sent });
    return await Promise.resolve(Response.json(body));
  };
  return {
    connection: {
      model: "fixture",
      api: "responses",
      prices: { input: 1, output: 10 },
      baseUrl: "https://llm.test/v1",
      apiKey: "x",
      fetch,
      ...connection,
    },
    requests,
  };
}

describe("Conversation", () => {
  /** A rejected request, such as a bad key, must fail the case rather than read as no answer. */
  it("throws with the status and body when the endpoint rejects the request", async () => {
    // Arrange
    const fetch: typeof globalThis.fetch = async () =>
      await Promise.resolve(new Response("invalid api key", { status: 401 }));
    const { connection } = answering({}, { fetch });
    const conversation = new Conversation(connection, "Be brief.");

    // Act
    const turn = conversation.ask("hello");

    // Assert
    await expect(turn).rejects.toThrow("fixture answered 401: invalid api key");
    expect(conversation.requests).toBe(0);
  });

  it("asks the Responses API with flat tools, storing nothing at the provider", async () => {
    // Arrange
    const { connection, requests } = answering({ output: [] }, { effort: "high" });

    // Act
    await new Conversation(connection, "Be brief.").ask("hello", [tool]);

    // Assert
    expect(requests).toEqual([
      {
        url: "https://llm.test/v1/responses",
        body: {
          model: "fixture",
          instructions: "Be brief.",
          input: [{ role: "user", content: "hello" }],
          store: false,
          tools: [{ type: "function", ...tool.function }],
          reasoning: { effort: "high" },
        },
      },
    ]);
  });

  /** The API refuses tool results whose call's reasoning item is missing. */
  it("carries a reasoning model's output back whole, with each call's result after it", async () => {
    // Arrange
    const reasoning = { type: "reasoning", id: "rs_1", encrypted_content: "sealed" };
    const call = {
      type: "function_call",
      id: "fc_1",
      call_id: "call_1",
      name: "lookup",
      arguments: '{"word":"lien"}',
    };
    const { connection, requests } = answering({ output: [reasoning, call] });
    const conversation = new Conversation(connection, "Be brief.");

    // Act
    const turn = await conversation.ask("hello", [tool]);
    await conversation.answer([{ role: "tool", tool_call_id: "call_1", content: "A claim." }]);

    // Assert
    expect(turn).toEqual({
      content: "",
      calls: [{ id: "call_1", function: { name: "lookup", arguments: '{"word":"lien"}' } }],
    });
    expect(requests[1]?.body["input"]).toEqual([
      { role: "user", content: "hello" },
      reasoning,
      call,
      { type: "function_call_output", call_id: "call_1", output: "A claim." },
    ]);
  });

  it("reads a Responses message's text parts as the turn's content", async () => {
    // Arrange
    const { connection } = answering({
      output: [
        { type: "reasoning", id: "rs_1" },
        {
          type: "message",
          content: [
            { type: "output_text", text: "Entail" },
            { type: "output_text", text: "ment" },
          ],
        },
      ],
    });

    // Act
    const turn = await new Conversation(connection, "Be brief.").ask("hello");

    // Assert
    expect(turn).toEqual({ content: "Entailment", calls: [] });
  });

  /** A long tool definition resent every turn is mostly read from cache, at a lower price. */
  it.each([
    [
      "responses",
      { input_tokens: 1000, input_tokens_details: { cached_tokens: 800 }, output_tokens: 10 },
    ],
    [
      "chat",
      { prompt_tokens: 1000, prompt_tokens_details: { cached_tokens: 800 }, completion_tokens: 10 },
    ],
  ] as const)("prices cached input at its own price over %s", async (api, usage) => {
    // Arrange
    const { connection } = answering(
      { output: [], choices: [{ message: { role: "assistant", content: "" } }], usage },
      { api, prices: { input: 1, output: 10, cachedInput: 0.1 } },
    );
    const conversation = new Conversation(connection, "Be brief.");

    // Act
    await conversation.ask("hello");

    // Assert
    expect(conversation.usage()).toEqual({
      model: "fixture",
      requests: 1,
      inputTokens: 1000,
      usd: (200 * 1 + 800 * 0.1 + 10 * 10) / 1_000_000,
    });
  });

  it("answers tool calls over Chat Completions with tool messages", async () => {
    // Arrange
    const { connection, sent } = scripted([["lookup", { word: "lien" }]], "Done.");
    const conversation = new Conversation(connection, "Be brief.");

    // Act
    const { calls } = await conversation.ask("hello", [tool]);
    await conversation.answer([
      { role: "tool", tool_call_id: calls[0]?.id ?? "", content: "A claim." },
    ]);

    // Assert
    expect(sent[1]).toMatchObject([
      { role: "system", content: "Be brief." },
      { role: "user", content: "hello" },
      { role: "assistant", tool_calls: [{ id: "call_1_0" }] },
      { role: "tool", tool_call_id: "call_1_0", content: "A claim." },
    ]);
  });
});

describe("identityOf", () => {
  /** Two efforts of one model are two configurations, and their reports must not share a name. */
  it("names a connection by its model and reasoning effort", () => {
    // Arrange
    const { connection } = answering({}, { model: "vendor/model 2", effort: "high" });

    // Act
    const { suffix, config } = identityOf(connection);

    // Assert
    expect(suffix).toBe("vendor-model-2-high");
    expect(config).toMatchObject({ model: "vendor/model 2", api: "responses", effort: "high" });
  });
});
