/**
 * OpenAI's Responses API. The conversation is kept here and sent whole with each request
 * (`store: false`), so nothing of a run stays at the provider. A reasoning model's
 * reasoning items come back encrypted and are carried like any other output, which the
 * API requires of a request that answers tool calls.
 */
import type { OpenAIToolCall } from "@factbag/openai";
import { count, field, record } from "./wire";
import type { Item, Wire } from "./wire";

export const RESPONSES: Wire = {
  path: "/responses",
  user: (said) => ({ role: "user", content: said }),
  result: ({ tool_call_id: id, content }) => ({
    type: "function_call_output",
    call_id: id,
    output: content,
  }),
  body: ({ model, effort, instructions, items, tools }) => ({
    model,
    instructions,
    input: items,
    store: false,
    // A function tool is written flat here, not under `function` as Chat Completions has it.
    ...(tools.length > 0
      ? { tools: tools.map((tool) => ({ type: tool.type, ...tool.function })) }
      : {}),
    ...(effort === undefined ? {} : { reasoning: { effort } }),
  }),
  read(body) {
    const output = field(body, "output");
    if (!Array.isArray(output)) {
      return undefined;
    }
    const items = output.flatMap((item): Item[] => {
      const read = record(item);
      return read === undefined ? [] : [read];
    });
    const usage = field(body, "usage");
    return {
      items,
      content: items.flatMap(text).join(""),
      calls: items.flatMap(toolCall),
      tokens: {
        input: count(field(usage, "input_tokens")),
        cached: count(field(field(usage, "input_tokens_details"), "cached_tokens")),
        output: count(field(usage, "output_tokens")),
      },
    };
  },
};

/** The text parts of a message item; nothing for any other item. */
function text(item: Item): string[] {
  const { type, content } = item;
  if (type !== "message" || !Array.isArray(content)) {
    return [];
  }
  return content.flatMap((part) => {
    const written = field(part, "text");
    return field(part, "type") === "output_text" && typeof written === "string" ? [written] : [];
  });
}

/** A function call item as the tool call it is; nothing for any other item. */
function toolCall(item: Item): OpenAIToolCall[] {
  const { type, call_id: id, name, arguments: args } = item;
  return type === "function_call" &&
    typeof id === "string" &&
    typeof name === "string" &&
    typeof args === "string"
    ? [{ id, function: { name, arguments: args } }]
    : [];
}
