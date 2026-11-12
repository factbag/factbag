import type { Entity, GroundAtom, QueryJudgment, RuntimeConstructor } from "factbag/dsl";
import type { ExplanationOptions } from "factbag/explain";

/**
 * JSON Schema for one tool argument. Dates are ISO 8601 strings and entities are
 * their IDs, so every argument is a JSON primitive.
 *
 * @beta
 */
export type ToolFieldSchema = Readonly<{
  type: "string" | "number" | "boolean";
  description?: string;
  enum?: readonly (string | number)[];
}>;

/**
 * JSON Schema for a tool's arguments. Every property is required and no others are
 * allowed, which is what OpenAI's strict function calling requires.
 *
 * @beta
 */
export type ToolInputSchema = Readonly<{
  type: "object";
  additionalProperties: false;
  required: readonly string[];
  properties: Readonly<Record<string, ToolFieldSchema>>;
}>;

/**
 * What a model is told about one tool. Provider packages translate it into their wire
 * format; {@link Toolkit.call} runs it.
 *
 * @beta
 */
export type ToolDefinition = Readonly<{
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}>;

/**
 * Options shared by every tool a toolkit exposes.
 *
 * @beta
 */
export type ToolkitOptions = Readonly<{
  /**
   * Require a `justification` argument on assert and deny tools, and store it in the
   * evidence's metadata. Defaults to true.
   */
  requireJustification?: boolean;
  /** Stored as `source` in the metadata of all evidence the tools write. */
  source?: string;
  /**
   * Tell the model why a query has its value: the reply then carries the judgment's
   * explanation. Defaults to false, so that the model is told the value alone.
   *
   * A whole proof can be hundreds of claims, megabytes written out, and every later
   * request of the conversation carries it. So the explanation is always cut to a
   * budget of claims, those that decided the value first: 20 for `true`, or the
   * `budget` you give.
   */
  explain?: boolean | ExplanationOptions;
  /**
   * Entity classes the model may register, each with the factory that makes an entity
   * from the id the model gives. Each lets the model run `add` on the class, named in
   * snake case: `person` for `Person`. Without it, the model can only refer to entities the knowledge base
   * already holds.
   */
  entities?: readonly (readonly [RuntimeConstructor<Entity>, (id: string) => Entity])[];
}>;

/**
 * What a tool call did, for the code that runs the model: the fact written, the judgment
 * a query reached, or the entity registered.
 *
 * @beta
 */
export type ToolOutcome =
  | Readonly<{ operation: "assert" | "deny"; atom: GroundAtom }>
  | Readonly<{ operation: "query"; atom: GroundAtom; judgment: QueryJudgment }>
  | Readonly<{ operation: "add"; entity: Entity }>;

/**
 * The result of one tool call: `text` is what the model is told, and `outcome` is the
 * same thing for the caller.
 *
 * @beta
 */
export type ToolResult = Readonly<{ text: string; outcome: ToolOutcome }>;
