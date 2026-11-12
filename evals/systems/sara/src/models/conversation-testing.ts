import type { Connection } from "./conversation";
import type { Item } from "./wire";

/** One scripted model turn: tool calls as `[name, arguments]` pairs, or the text it says. */
export type Turn = readonly (readonly [string, Readonly<Record<string, unknown>>])[] | string;

/**
 * A connection to a fake endpoint that gives `turns` in order, each for 100 input and 10
 * output tokens, at USD 1 and 10 per million. It answers Chat Completions and the
 * Responses API alike, so a test picks the API with the connection's `api`; Chat
 * Completions unless it does. `sent` collects the conversation each request carried, its
 * `messages` or its `input`, so a test can see what the model was told.
 */
export function scripted(...turns: readonly Turn[]): {
  connection: Connection;
  sent: (readonly Item[])[];
} {
  const sent: (readonly Item[])[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The client sends JSON.
    const request = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
      messages?: readonly Item[];
      input?: readonly Item[];
    };
    const turn = turns[sent.length] ?? "";
    sent.push(request.messages ?? request.input ?? []);
    const calls = (typeof turn === "string" ? [] : turn).map(([name, args], index) => ({
      id: `call_${sent.length}_${index}`,
      name,
      arguments: JSON.stringify(args),
    }));
    const text = typeof turn === "string" ? turn : undefined;
    return await Promise.resolve(
      Response.json(
        typeof url === "string" && url.endsWith("/responses")
          ? {
              output: [
                ...(text === undefined
                  ? []
                  : [{ type: "message", content: [{ type: "output_text", text }] }]),
                ...calls.map(({ id, ...call }) => ({
                  type: "function_call",
                  call_id: id,
                  ...call,
                })),
              ],
              usage: { input_tokens: 100, output_tokens: 10 },
            }
          : {
              choices: [
                {
                  message:
                    text === undefined
                      ? {
                          role: "assistant",
                          content: null,
                          tool_calls: calls.map(({ id, ...called }) => ({
                            id,
                            type: "function",
                            function: called,
                          })),
                        }
                      : { role: "assistant", content: text },
                },
              ],
              usage: { prompt_tokens: 100, completion_tokens: 10 },
            },
      ),
    );
  };
  return {
    connection: {
      model: "fixture",
      api: "chat",
      prices: { input: 1, output: 10 },
      baseUrl: "https://llm.test/v1",
      apiKey: "test",
      fetch,
    },
    sent,
  };
}
