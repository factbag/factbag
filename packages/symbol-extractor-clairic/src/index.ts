/**
 * Candidate symbol extraction with Cloudflare's Clairic model on Workers AI.
 *
 * @packageDocumentation
 */
import type { Entity, PredicateDeclaration, RuntimeConstructor, Scalar } from "factbag/dsl";
import type { Chunk } from "factbag/corpus";
import type { ChunkSymbolExtractor } from "@factbag/system-one";
import { fieldEquals } from "factbag/dsl";
import { connect, isRecord } from "./workers-ai";
import type { Send } from "./workers-ai";

/**
 * How to reach Clairic, and how to turn the names it reads into entities. Requests go
 * through `binding` when one is given, and otherwise through Cloudflare's REST API.
 * @beta
 */
export type SymbolExtractorConfig = {
  /** A Workers AI binding, such as `env.AI` inside a Worker. No credentials are read when set. */
  readonly binding?: {
    readonly run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
  };
  /** REST only: the Cloudflare account. Defaults to CLOUDFLARE_ACCOUNT_ID. */
  readonly accountId?: string;
  /** REST only: an API token with Workers AI access. Defaults to CLOUDFLARE_API_TOKEN. */
  readonly apiToken?: string;
  /** REST only: the fetch implementation, default the global `fetch`. Retries and timeouts belong here. */
  readonly fetch?: typeof globalThis.fetch;
  /**
   * Factories that turn names read for an entity field into entities, one per entity
   * class. Fields of other entity classes are not sent to Clairic; Jev and Clef still offer their
   * registered entities.
   */
  readonly entities?: readonly (readonly [RuntimeConstructor<Entity>, (name: string) => Entity])[];
  /** An ISO date, such as `"2024-06-01"`, that anchors dates written without a year. */
  readonly referenceDate?: string;
  /**
   * The most fields one request asks about, default 8. A query with more fields sends
   * several requests per chunk, in parallel. Clairic misreads values more often when one
   * request asks about many fields.
   */
  readonly batchSize?: number;
};

const DEFAULT_BATCH_SIZE = 8;

type Candidate = Scalar | Entity;

/** One requested predicate field, as Clairic will be asked about it. */
type Question = {
  readonly predicate: PredicateDeclaration;
  readonly field: string;
  readonly spec: { readonly type: "list"; readonly items: Item } & Record<string, unknown>;
  readonly toValue: (item: unknown) => Candidate | undefined;
};

type Item = "text" | "number" | "date";

const SCALARS = new Set<unknown>([String, Number, Date, Boolean, BigInt]);

/**
 * Ask Clairic, per chunk and query, for every value in the passage that could fill each
 * requested field, at most `batchSize` fields to a request. Each field becomes a Clairic list field whose instructions name
 * the predicate and field and quote their descriptions, so values are read for that
 * field rather than by type alone. `String` fields take text spans, `Number` fields
 * numbers, `Date` fields dates, and entity fields text spans passed through the class's
 * factory. Requests are sent on query, not at construction. A failed request rejects
 * the query. Throws `RangeError` at construction for a `batchSize` that is not a positive
 * integer.
 * @beta
 */
export function createChunkSymbolExtractor(
  chunks: readonly Chunk[],
  config: SymbolExtractorConfig = {},
): ChunkSymbolExtractor {
  const factories = configure(config.entities ?? []);
  const { batchSize = DEFAULT_BATCH_SIZE } = config;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new RangeError(`batchSize must be a positive integer, received ${batchSize}`);
  }
  const send = connect(config);
  const states = chunks.map((chunk) => chunk.text).filter((state) => state.trim().length > 0);
  return {
    query: async (requests) => {
      const questions = [...requests].flatMap(([predicate, fields]) =>
        fields.flatMap((field) => question(predicate, field, factories) ?? []),
      );
      const batches = Array.from({ length: Math.ceil(questions.length / batchSize) }, (_, at) =>
        questions.slice(at * batchSize, (at + 1) * batchSize),
      );
      // Each chunk's answers, by question index, joined from its batches in order.
      const answers = await Promise.all(
        states.map(async (state) =>
          (
            await Promise.all(
              batches.map(async (batch) => await ask(send, state, batch, config.referenceDate)),
            )
          ).flat(),
        ),
      );
      /** Values read for one field across chunks, or none for a field never asked about. */
      const offered = (predicate: PredicateDeclaration, field: string): readonly Candidate[] => {
        const index = questions.findIndex((q) => q.predicate === predicate && q.field === field);
        const values = index === -1 ? [] : answers.flatMap((answer) => answer[index] ?? []);
        return values.filter(
          (value, at) => values.findIndex((other) => fieldEquals(value, other)) === at,
        );
      };
      return new Map(
        [...requests].map(([predicate, fields]) => [
          predicate,
          Object.fromEntries(fields.map((field) => [field, offered(predicate, field)])),
        ]),
      );
    },
  };
}

/** Validate entity factories at construction, before any request. */
function configure(
  entities: NonNullable<SymbolExtractorConfig["entities"]>,
): ReadonlyMap<unknown, (name: string) => Entity> {
  const factories = new Map<unknown, (name: string) => Entity>();
  for (const [type, create] of entities) {
    const isClass = typeof type === "function" && "prototype" in type && !SCALARS.has(type);
    if (!isClass || typeof create !== "function" || factories.has(type)) {
      throw new TypeError(`Invalid entity factory for ${type.name}`);
    }
    factories.set(type, create);
  }
  return factories;
}

/** How to ask for one field, or nothing for a field Clairic cannot fill. */
function question(
  predicate: PredicateDeclaration,
  field: string,
  factories: ReadonlyMap<unknown, (name: string) => Entity>,
): Question | undefined {
  const type = predicate.params[field];
  const instructions = describe(predicate, field);
  if (type === String) {
    return { predicate, field, spec: list("text", instructions), toValue: text };
  }
  if (type === Number) {
    // Six decimals, Clairic's maximum, so amounts are not rounded.
    return {
      predicate,
      field,
      spec: { ...list("number", instructions), decimals: 6 },
      toValue: number,
    };
  }
  if (type === Date) {
    return { predicate, field, spec: list("date", instructions), toValue: date };
  }
  const create = factories.get(type);
  if (create === undefined) {
    return undefined;
  }
  return {
    predicate,
    field,
    spec: list("text", instructions),
    toValue: (item) => {
      const name = text(item);
      return name === undefined ? undefined : create(name);
    },
  };
}

function list(items: Item, instructions: string): Question["spec"] {
  return { type: "list", items, instructions };
}

/** Field instructions from the predicate's own metadata. Judging guidance is left to Jev. */
function describe(predicate: PredicateDeclaration, field: string): string {
  const { description, parameters } = predicate.metadata ?? {};
  return [
    `Every value in the text that could fill "${field}" in the relation "${predicate.name}".`,
    description === undefined ? undefined : `The relation: ${description}`,
    parameters?.[field] === undefined ? undefined : `"${field}": ${parameters[field]}`,
    "Include values even when the text denies or doubts the relation.",
  ]
    .filter((line) => line !== undefined)
    .join(" ");
}

/** One request for one passage: the values read for each question, by question index. */
async function ask(
  send: Send,
  state: string,
  questions: readonly Question[],
  referenceDate: string | undefined,
): Promise<readonly (readonly Candidate[])[]> {
  if (questions.length === 0) {
    return [];
  }
  const output = await send({
    model: "clairic",
    state,
    fields: Object.fromEntries(questions.map(({ spec }, index) => [`f${index}`, spec])),
    ...(referenceDate === undefined ? {} : { reference_date: referenceDate }),
  });
  const answers = isRecord(output) ? output["answers"] : undefined;
  if (!isRecord(answers)) {
    throw new Error("Clairic returned no answers");
  }
  return questions.map(({ toValue }, index) => {
    const answer = answers[`f${index}`];
    if (!isRecord(answer)) {
      throw new Error(`Clairic did not answer field f${index}`);
    }
    const { value } = answer;
    // A null value means the passage determines nothing for the field.
    if (value === null || value === undefined) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new Error(`Clairic answered field f${index} with a ${typeof value}, not a list`);
    }
    // Clairic may read an item it cannot normalize; skip it rather than fail the passage.
    return value.flatMap((item) => toValue(item) ?? []);
  });
}

function text(item: unknown): string | undefined {
  return typeof item === "string" && item.trim().length > 0 ? item.trim() : undefined;
}

function number(item: unknown): number | undefined {
  return typeof item === "number" && Number.isFinite(item) ? item : undefined;
}

/** Calendar dates as UTC midnight, matching how Factbag compares dates. */
function date(item: unknown): Date | undefined {
  if (typeof item !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(item)) {
    return undefined;
  }
  const value = new Date(`${item}T00:00:00Z`);
  return Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== item
    ? undefined
    : value;
}
