/**
 * Chat Completions, which OpenAI and most other providers serve. OpenAI's reasoning
 * models refuse function tools here; they take them through `./responses`.
 */
import type { OpenAIToolCall } from "@factbag/openai";
import { count, field, record } from "./wire";
import type { Wire } from "./wire";

export const CHAT: Wire = {
  path: "/chat/completions",
  user: (text) => ({ role: "user", content: text }),
  result: (message) => message,
  body: ({ model, effort, instructions, items, tools }) => ({
    model,
    messages: [{ role: "system", content: instructions }, ...items],
    ...(tools.length > 0 ? { tools } : {}),
    ...(effort === undefined ? {} : { reasoning_effort: effort }),
  }),
  read(body) {
    const choices = field(body, "choices");
    const message = record(field(Array.isArray(choices) ? choices[0] : undefined, "message"));
    if (message === undefined) {
      return undefined;
    }
    const usage = field(body, "usage");
    const { content, tool_calls: calls } = message;
    return {
      items: [message],
      content: typeof content === "string" ? content : "",
      calls: Array.isArray(calls) ? calls.flatMap(toolCall) : [],
      tokens: {
        input: count(field(usage, "prompt_tokens")),
        cached: count(field(field(usage, "prompt_tokens_details"), "cached_tokens")),
        output: count(field(usage, "completion_tokens")),
      },
    };
  },
};

/** A function tool call, or nothing for any other kind of call. */
function toolCall(value: unknown): OpenAIToolCall[] {
  const id = field(value, "id");
  const called = field(value, "function");
  const name = field(called, "name");
  const args = field(called, "arguments");
  return typeof id === "string" && typeof name === "string" && typeof args === "string"
    ? [{ id, function: { name, arguments: args } }]
    : [];
}
