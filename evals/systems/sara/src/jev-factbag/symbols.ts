import { predicate } from "factbag/dsl";
import type { PredicateDeclaration } from "factbag/dsl";
import type { Chunk } from "factbag/corpus";
import { createChunkSymbolExtractor } from "@factbag/symbol-extractor-clairic";
import type { SymbolExtractorConfig } from "@factbag/symbol-extractor-clairic";
import { retrying } from "../models/retry";
import { Person } from "../statute/schema";

/** How to reach Clairic over Cloudflare's REST API; credentials default to the environment. */
type Connection = Pick<SymbolExtractorConfig, "accountId" | "apiToken" | "fetch">;

/** A person's id is their name as Clairic reads it, so equal names are one person. */
const ENTITIES: NonNullable<SymbolExtractorConfig["entities"]> = [
  [Person, (name) => new Person(name)],
];

/** Not a fact: the field asked of Clairic to list the people a case text names. */
const named = predicate(
  "named",
  { person: Person },
  {
    description: "The text names the person.",
    parameters: { person: "A person, by the name the text uses for them." },
  },
);

/** What a case has asked of Clairic so far: the requests answered and their input tokens. */
export type ClairicUsage = { requests: number; inputTokens: number };

/**
 * How this eval asks Clairic: people by name, a request Workers AI answers with 429 retried
 * after 1, 2, 4 and 8 seconds, or after the `retry-after` the response gives, and each
 * answered request added to `usage`. One `usage` per case meters the case.
 */
export function clairicConfig(
  usage: ClairicUsage,
  connection: Connection = {},
): SymbolExtractorConfig {
  const send = connection.fetch ?? globalThis.fetch;
  return {
    ...connection,
    entities: ENTITIES,
    fetch: async (input, init) => {
      const response = await retrying(async () => await send(input, init));
      usage.requests += 1;
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => undefined);
      usage.inputTokens += inputTokensOf(body);
      return response;
    },
  };
}

/** Every value Clairic reads from a whole text for each field of a predicate. */
export async function read(
  config: SymbolExtractorConfig,
  text: string,
  declaration: PredicateDeclaration,
): Promise<Readonly<Record<string, readonly unknown[]>>> {
  const chunk: Chunk = {
    documentId: "text",
    id: "text",
    range: { start: 0, end: text.length },
    text,
  };
  const answer = await createChunkSymbolExtractor([chunk], config).query(
    new Map([[declaration, Object.keys(declaration.params)]]),
  );
  return answer.get(declaration) ?? {};
}

/** The people a text names. */
export async function people(
  config: SymbolExtractorConfig,
  text: string,
): Promise<readonly Person[]> {
  const values = await read(config, text, named);
  return (values["person"] ?? []).filter((value) => value instanceof Person);
}

/** The input tokens in a Workers AI envelope's `result.usage`, or none when it has none. */
function inputTokensOf(body: unknown): number {
  const usage = field(field(body, "result"), "usage");
  const tokens = field(usage, "input_tokens");
  return typeof tokens === "number" ? tokens : 0;
}

function field(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const found: unknown = Object.getOwnPropertyDescriptor(value, name)?.value;
  return found;
}
