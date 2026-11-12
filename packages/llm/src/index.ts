/**
 * A guarded knowledge base's operations as provider-neutral LLM tools. Provider packages
 * translate the tool definitions into their wire format and re-export the toolkit;
 * applications import the provider package, not this one.
 *
 * @packageDocumentation
 */
export { CorrectableToolError } from "./errors";
export { Toolkit, toolkit } from "./toolkit";
export type {
  ToolDefinition,
  ToolFieldSchema,
  ToolInputSchema,
  ToolkitOptions,
  ToolOutcome,
  ToolResult,
} from "./types";
