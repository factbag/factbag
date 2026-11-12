/**
 * What differs between the two APIs a model is asked through: where a request goes, how
 * it is written and how its answer is read. `Conversation` owns everything else.
 */
import type { OpenAITool, OpenAIToolCall, OpenAIToolMessage } from "@factbag/openai";

/** One entry of a conversation as its API carries it. */
export type Item = Readonly<Record<string, unknown>>;

type Request = Readonly<{
  model: string;
  /** How hard a reasoning model thinks, when the run says. */
  effort: string | undefined;
  instructions: string;
  items: readonly Item[];
  tools: readonly OpenAITool[];
}>;

/** One model turn as read off the answer. */
type Reading = Readonly<{
  /** What the model put out, to carry in the next request exactly as it came. */
  items: readonly Item[];
  /** Its text, empty when it only called tools. */
  content: string;
  calls: readonly OpenAIToolCall[];
  /** `input` counts the cached tokens too. */
  tokens: Readonly<{ input: number; cached: number; output: number }>;
}>;

export type Wire = Readonly<{
  /** Under the connection's base URL. */
  path: string;
  user: (text: string) => Item;
  /** The answer to one of the model's tool calls. */
  result: (message: OpenAIToolMessage) => Item;
  body: (request: Request) => unknown;
  /** Nothing when the answer carries no model turn. */
  read: (body: unknown) => Reading | undefined;
}>;

export function record(value: unknown): Item | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined;
}

export function field(value: unknown, name: string): unknown {
  return record(value)?.[name];
}

export function count(value: unknown): number {
  return typeof value === "number" ? value : 0;
}
