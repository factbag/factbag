/**
 * Factbag knowledge-base operations as tools for OpenAI and OpenAI-compatible Chat
 * Completions APIs. This package describes and runs the tools; your code calls the model.
 *
 * @packageDocumentation
 */
export type { ToolkitOptions, ToolOutcome } from "@factbag/llm";
export { Toolkit, toolkit } from "./openai";
export type { OpenAITool, OpenAIToolAnswer, OpenAIToolCall, OpenAIToolMessage } from "./openai";
