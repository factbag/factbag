import type {
  QueryJudgment,
  Entity,
  GroundAtom,
  PredicateDeclaration,
  RuntimeConstructor,
} from "factbag/dsl";
import { explainJudgment } from "factbag/explain";
import type { Explanation } from "factbag/explain";
import type { EvidenceMetadata, GuardedKB, Operation } from "factbag/kb";
import { CorrectableToolError } from "./errors";
import { fieldSchema, parseField } from "./fields";
import type { ToolDefinition, ToolFieldSchema, ToolkitOptions, ToolResult } from "./types";

/**
 * The claims a query's reply explains unless told otherwise. A whole proof written out is
 * megabytes; this many claims is a few kilobytes, and what decided the value comes first.
 */
const EXPLANATION_BUDGET = 20;

/** What a call can do. `add` registers an entity; the others are the guard's operations. */
type Verb = Operation | "add";

/** One thing the tool can do: assert `employed`, query `eligible`, add a `person`. */
type Action = Readonly<{
  operation: Verb;
  /** The predicate, or the entity class in snake case, that the operation acts on. */
  name: string;
  /** What the name stands for, as its author described it. */
  about: string;
  /** The arguments, all required. Every operation on one name takes the same ones. */
  properties: Readonly<Record<string, ToolFieldSchema>>;
  /** Whether a `justification` is required beside them. */
  justified: boolean;
  run: (args: Readonly<Record<string, unknown>>) => ToolResult;
}>;

/** The argument an assert or deny takes beside the predicate's own. A query does not take it. */
const JUSTIFICATION: ToolFieldSchema = {
  type: "string",
  description:
    "For assert and deny only, which require it. Why the source supports this, citing it " +
    "where possible",
};

/** The one tool a toolkit offers. */
const TOOL = "knowledge_base";

/**
 * The guarded knowledge base as one tool a model can call, `knowledge_base`, which runs
 * one operation per call: `assert`, `deny` or `query` on a permitted predicate, or `add`
 * for an entity class the options let the model register. A call names the operation and
 * what it acts on separately. The guard decides which operations exist; the toolkit only
 * describes and runs them. Calling the model is the caller's job.
 *
 * One tool rather than one per operation, because a definition per operation says the
 * same things many times: each restates its name as a sentence, each argument that names
 * a person carries the same paragraph on how people are named, and each is wrapped in
 * its own JSON Schema. For a hundred predicates that is tens of thousands of tokens in
 * every request, about twice what the one tool's description costs. And the operation is
 * its own argument, not part of a name, so that a predicate is described once however
 * many operations it allows.
 *
 * @beta
 */
export class Toolkit {
  readonly #access: GuardedKB;
  readonly #options: ToolkitOptions;
  readonly #entityActions: readonly Action[];

  /** Throws for entity classes whose names are the same in snake case. */
  constructor(access: GuardedKB, options: ToolkitOptions = {}) {
    this.#access = access;
    this.#options = options;
    this.#entityActions = (options.entities ?? []).map(([type, create]) =>
      entityAction(access, type, create),
    );
    const names = this.#entityActions.map((action) => action.name);
    const repeated = names.find((name, index) => names.indexOf(name) !== index);
    if (repeated !== undefined) {
      throw new TypeError(`Two entity classes share the name ${repeated}`);
    }
  }

  /**
   * The tool, describing the operations the guard permits now. Wildcard grants and entity
   * IDs are read from the KB on every call, so call this again before each model request.
   */
  tools(): readonly ToolDefinition[] {
    return [describeTool(this.#actions())];
  }

  /**
   * Run a call of the tool and return its result: the text for the model, and what the
   * call did for the caller. `args` gives the `operation`, the `name` it acts on, and its
   * `arguments` as a JSON object in a string. Throws {@link CorrectableToolError} for an
   * unknown tool, an operation the name does not allow, or invalid arguments; any other
   * error is not the model's to fix.
   */
  call(name: string, args: unknown): ToolResult {
    if (name !== TOOL) {
      throw new CorrectableToolError(`Unknown tool: ${name}`);
    }
    const called = operationCalled(args);
    const action = this.#actions().find(
      (one) => one.operation === called.operation && one.name === called.name,
    );
    if (action === undefined) {
      throw new CorrectableToolError(`Unknown operation: ${called.operation} ${called.name}`);
    }
    const given = called.arguments;
    if (typeof given !== "object" || given === null || Array.isArray(given)) {
      throw new CorrectableToolError("Expected the arguments to be a JSON object");
    }
    const record: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(given));
    const allowed = new Set([
      ...Object.keys(action.properties),
      ...(action.justified ? ["justification"] : []),
    ]);
    for (const key of Object.keys(record)) {
      if (!allowed.has(key)) {
        throw new CorrectableToolError(`Unexpected argument: ${key}`);
      }
    }
    for (const key of allowed) {
      if (!(key in record)) {
        throw new CorrectableToolError(`Missing argument: ${key}`);
      }
    }
    return action.run(record);
  }

  #actions(): readonly Action[] {
    const actions = [...this.#entityActions];
    const predicates = new Map<string, PredicateDeclaration>();
    for (const { operation, predicate } of this.#access.resolve()) {
      if ((predicates.get(predicate.name) ?? predicate) !== predicate) {
        throw new Error(`Two permitted predicates are named ${predicate.name}`);
      }
      predicates.set(predicate.name, predicate);
      actions.push(this.#action(operation, predicate));
    }
    return actions;
  }

  #action(operation: Operation, predicate: PredicateDeclaration): Action {
    const kb = this.#access.kb;
    const justify = operation !== "query" && this.#options.requireJustification !== false;
    const properties: Record<string, ToolFieldSchema> = {};
    for (const name of predicate.paramNames) {
      const parameter = predicate.metadata?.parameters?.[name];
      const schema = fieldSchema(kb, field(predicate, name));
      properties[name] =
        parameter === undefined
          ? schema
          : { ...schema, description: [parameter, schema.description].filter(Boolean).join(". ") };
    }
    const about = [predicate.metadata?.description, predicate.metadata?.instructions]
      .filter(Boolean)
      .join(" ");

    const atomOf = (args: Readonly<Record<string, unknown>>): GroundAtom => ({
      predicate,
      fields: Object.fromEntries(
        predicate.paramNames.map((name) => [
          name,
          parseField(kb, name, field(predicate, name), args[name]),
        ]),
      ),
    });

    return {
      operation,
      name: predicate.name,
      about,
      properties,
      justified: justify,
      run: (args) => {
        const atom = atomOf(args);
        if (operation === "query") {
          const judgment = this.#access.query(atom);
          return {
            text: JSON.stringify({
              value: judgment.value,
              ...this.#explain(judgment),
            }),
            outcome: { operation, atom, judgment },
          };
        }
        const metadata = this.#metadata(justify ? args["justification"] : undefined);
        if (operation === "assert") {
          this.#access.asserts(atom, metadata);
        } else {
          this.#access.denies(atom, metadata);
        }
        return {
          text: `${operation === "assert" ? "Asserted" : "Denied"} ${describeAtom(atom)}`,
          outcome: { operation, atom },
        };
      },
    };
  }

  /** What a query's reply says beyond the value: nothing, or why it has that value. */
  #explain(judgment: QueryJudgment): { explanation?: Explanation } {
    const { explain = false } = this.#options;
    if (explain === false) {
      return {};
    }
    const options = { budget: EXPLANATION_BUDGET, ...(explain === true ? {} : explain) };
    return { explanation: explainJudgment(judgment, options) };
  }

  #metadata(justification: unknown): EvidenceMetadata | undefined {
    if (justification !== undefined && typeof justification !== "string") {
      throw new CorrectableToolError("Expected justification to be a string");
    }
    const metadata: { source?: string; justification?: string } = {};
    if (this.#options.source !== undefined) {
      metadata.source = this.#options.source;
    }
    if (justification !== undefined) {
      metadata.justification = justification;
    }
    return Object.keys(metadata).length === 0 ? undefined : metadata;
  }
}

/**
 * Expose a guarded knowledge base's permitted operations as LLM tools.
 *
 * @example
 * ```ts
 * const kit = toolkit(guard(kb).permit("assert", employed).permit("query", eligible), {
 *   source: "intake-chat",
 * });
 * kit.tools(); // describe these to the model
 * kit.call("knowledge_base", {
 *   operation: "assert",
 *   name: "employed",
 *   arguments: '{"person":"ada","justification":"She says so"}',
 * }).text;
 * ```
 *
 * @beta
 */
export function toolkit(access: GuardedKB, options?: ToolkitOptions): Toolkit {
  return new Toolkit(access, options);
}

/**
 * The operation that registers an entity of one class: add `person` for `Person`. An id the
 * knowledge base already holds keeps its entity, so the model may register twice.
 */
function entityAction(
  access: GuardedKB,
  type: RuntimeConstructor<Entity>,
  create: (id: string) => Entity,
): Action {
  const snake = type.name.replaceAll(/(?<=[a-z0-9])(?=[A-Z])/gu, "_").toLowerCase();
  return {
    operation: "add",
    name: snake,
    about: `Register a ${type.name} before any other operation refers to it.`,
    properties: { id: { type: "string", description: `${type.name} id` } },
    justified: false,
    run: ({ id }) => {
      if (typeof id !== "string" || id.trim() === "") {
        throw new CorrectableToolError("Expected id to be a non-empty string");
      }
      const { entities } = access.kb;
      let entity = entities.get(type, id);
      if (entity === undefined) {
        entity = create(id);
        entities.add(entity);
      }
      return {
        text: `Registered ${type.name} ${entity.id}`,
        outcome: { operation: "add", entity },
      };
    },
  };
}

/**
 * The tool, whose description lists `actions`. Each name is a line, said once with the
 * operations it allows. An argument's note is stated once too and referred to by number,
 * since many arguments share one: every argument that names a person, a day or an amount.
 *
 * A call gives an operation's arguments as a JSON object in a string. A string is what
 * lets one tool take every operation's arguments and still be a strict function.
 */
function describeTool(actions: readonly Action[]): ToolDefinition {
  const notes = new Map<string, number>();
  const note = (schema: ToolFieldSchema): number => {
    const options = schema.enum === undefined ? "" : `, one of ${JSON.stringify(schema.enum)}`;
    const text = [`${schema.type}${options}`, schema.description].filter(Boolean).join(". ");
    const known = notes.get(text) ?? notes.size + 1;
    notes.set(text, known);
    return known;
  };
  // An entity class and a predicate may share a name; they are still two lines.
  const lines = new Map<string, { first: Action; operations: Verb[]; justified: boolean }>();
  for (const action of actions) {
    const key = `${action.operation === "add" ? "class" : "predicate"} ${action.name}`;
    const line = lines.get(key) ?? { first: action, operations: [], justified: false };
    line.operations.push(action.operation);
    line.justified ||= action.justified;
    lines.set(key, line);
  }
  const names = [...lines.values()].map(({ first, operations, justified }) => {
    // Said on every line that takes it: a model told once, above the list, leaves it out.
    const fields = Object.entries({
      ...first.properties,
      ...(justified ? { justification: JUSTIFICATION } : {}),
    }).map(([argument, schema]) => `${argument}[${note(schema)}]`);
    const said = first.about === "" ? "" : `: ${first.about}`;
    return `${first.name} [${operations.join(", ")}](${fields.join(", ")})${said}`;
  });
  const intro =
    "Read and write the knowledge base, one operation per call. A call gives the " +
    "`operation`, the `name` it acts on, and its `arguments`. `assert` records evidence " +
    "that a predicate holds, `deny` records evidence against it, `query` asks whether " +
    "the knowledge base concludes it, and `add` registers an entity of a class. Each " +
    "line below is a name, the operations it allows in brackets, and their arguments, " +
    "every one of them required. The number after an argument refers to the notes " +
    "below the names.";
  return {
    name: TOOL,
    description: [
      intro,
      `Names:\n${names.join("\n")}`,
      `Notes:\n${[...notes].map(([text, number]) => `[${number}] ${text}`).join("\n")}`,
    ].join("\n\n"),
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["operation", "name", "arguments"],
      properties: {
        operation: { type: "string", enum: [...new Set(actions.map((one) => one.operation))] },
        name: { type: "string", enum: [...new Set(actions.map((one) => one.name))] },
        arguments: {
          type: "string",
          description: 'The operation\'s arguments as a JSON object, such as {"id":"Alice"}',
        },
      },
    },
  };
}

/** The operation a call of the tool gives, the name it acts on, and its arguments. */
function operationCalled(args: unknown): { operation: string; name: string; arguments: unknown } {
  const {
    operation,
    name,
    arguments: text,
  } = typeof args === "object" && args !== null
    ? (args as { operation?: unknown; name?: unknown; arguments?: unknown })
    : {};
  if (typeof operation !== "string") {
    throw new CorrectableToolError("Expected operation to be assert, deny, query or add");
  }
  if (typeof name !== "string") {
    throw new CorrectableToolError("Expected name to be what the operation acts on");
  }
  if (typeof text !== "string") {
    throw new CorrectableToolError("Expected arguments to be a JSON object written as a string");
  }
  try {
    return { operation, name, arguments: JSON.parse(text) as unknown };
  } catch {
    throw new CorrectableToolError("The arguments are not valid JSON");
  }
}

function describeAtom({ predicate, fields }: GroundAtom): string {
  const values = predicate.paramNames.map((name) => {
    const value: unknown = fields[name];
    const text =
      value instanceof Date
        ? value.toISOString()
        : typeof value === "object" && value !== null && "id" in value
          ? String(value.id)
          : String(value);
    return `${name}=${text}`;
  });
  return `${predicate.name}(${values.join(", ")})`;
}

function field(
  predicate: PredicateDeclaration,
  name: string,
): PredicateDeclaration["params"][string] {
  const type = predicate.params[name];
  if (type === undefined) {
    throw new Error(`Predicate ${predicate.name} has no parameter ${name}`);
  }
  return type;
}
