import { CorrectableToolError, toolkit as neutralToolkit } from "@factbag/llm";
import type { ToolkitOptions, ToolOutcome } from "@factbag/llm";
import type { GuardedKB } from "factbag/kb";

/**
 * A strict function tool for the Chat Completions `tools` parameter.
 *
 * @beta
 */
export type OpenAITool = Readonly<{
  type: "function";
  function: Readonly<{
    name: string;
    description: string;
    /** JSON Schema for the arguments. */
    parameters: Readonly<Record<string, unknown>>;
    strict: true;
  }>;
}>;

/**
 * The parts of an assistant message's function tool call that are needed to answer it.
 * The `openai` package's function tool calls match this shape.
 *
 * @beta
 */
export type OpenAIToolCall = Readonly<{
  id: string;
  function: Readonly<{ name: string; arguments: string }>;
}>;

/**
 * The tool message that answers one tool call.
 *
 * @beta
 */
export type OpenAIToolMessage = Readonly<{
  role: "tool";
  tool_call_id: string;
  content: string;
}>;

/**
 * The answer to one tool call: `message` goes back to the model, and `outcome` tells your
 * code what the call did. There is no outcome when the call was a mistake the model can
 * fix; the message then says what was wrong.
 *
 * @beta
 */
export type OpenAIToolAnswer = Readonly<{
  message: OpenAIToolMessage;
  outcome: ToolOutcome | undefined;
}>;

/**
 * A guarded knowledge base as one tool for OpenAI or any OpenAI-compatible Chat
 * Completions API. The tool, `knowledge_base`, runs one operation per call: `assert`,
 * `deny`, or `query` on a permitted predicate, or `add` for an entity class the options
 * let the model register. The guard decides which operations exist. Your code calls the
 * model.
 *
 * @beta
 */
export class Toolkit {
  readonly #tools: ReturnType<typeof neutralToolkit>;

  constructor(access: GuardedKB, options?: ToolkitOptions) {
    this.#tools = neutralToolkit(access, options);
  }

  /**
   * The tool, for the request's `tools` parameter. Call this before each request: entity
   * IDs and wildcard grants are read from the knowledge base, so its description changes
   * as the knowledge base does.
   */
  tools(): readonly OpenAITool[] {
    return this.#tools.tools().map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
        strict: true,
      },
    }));
  }

  /**
   * Run one tool call from an assistant message and return the tool message that answers
   * it, with what the call did. A mistake the model can fix, such as malformed JSON, an
   * unknown tool, or an invalid argument, becomes `Error: …` in the message's content so
   * that the model can try again, and has no outcome. Other errors are thrown.
   */
  answer({ id, function: { name, arguments: text } }: OpenAIToolCall): OpenAIToolAnswer {
    const answer = (content: string, outcome?: ToolOutcome): OpenAIToolAnswer => ({
      message: { role: "tool", tool_call_id: id, content },
      outcome,
    });
    try {
      const result = this.#tools.call(name, parseArguments(text));
      return answer(result.text, result.outcome);
    } catch (error) {
      if (error instanceof CorrectableToolError) {
        return answer(`Error: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * Expose a guarded knowledge base's permitted operations as OpenAI tools.
 *
 * @example
 * ```ts
 * const kit = toolkit(guard(kb).permit("assert", employed), { source: "intake-chat" });
 * const response = await client.chat.completions.create({ model, messages, tools: kit.tools() });
 * for (const call of response.choices[0].message.tool_calls ?? []) {
 *   if (call.type === "function") messages.push(kit.answer(call).message);
 * }
 * ```
 *
 * @beta
 */
export function toolkit(access: GuardedKB, options?: ToolkitOptions): Toolkit {
  return new Toolkit(access, options);
}

function parseArguments(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CorrectableToolError("The arguments are not valid JSON");
  }
}
