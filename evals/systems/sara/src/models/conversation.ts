/**
 * A conversation with a model at an OpenAI-compatible endpoint, called with `fetch` and
 * metered. One `Conversation` per case holds the case's transcript and meters it. The
 * endpoint is asked through the Responses API or Chat Completions, as the connection says
 * (`./responses`, `./chat`); nothing outside this directory sees which. A request the
 * endpoint answers with 429 is retried (`./retry`); any other failure throws.
 */
import type { Flags, FlagValues, Usage } from "@factbag/eval-runner";
import type { OpenAITool, OpenAIToolCall, OpenAIToolMessage } from "@factbag/openai";
import { CHAT } from "./chat";
import { RESPONSES } from "./responses";
import { retrying } from "./retry";
import type { Item } from "./wire";

const WIRES = { responses: RESPONSES, chat: CHAT };

export type Connection = Readonly<{
  model: string;
  /** Which API the endpoint is asked through. */
  api: keyof typeof WIRES;
  /** How hard a reasoning model thinks, such as "low" or "high"; the model's default when left out. */
  effort?: string;
  /**
   * List prices in USD per million tokens, for the spend a run reports. Input the
   * endpoint read from its cache is priced at `cachedInput`, or as any other input when
   * that is left out.
   */
  prices: Readonly<{ input: number; output: number; cachedInput?: number }>;
  /** Defaults to $OPENAI_BASE_URL, else OpenAI's. */
  baseUrl?: string;
  /** Defaults to $OPENAI_API_KEY. */
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}>;

/**
 * The flags of a system that asks a model here: `--model`, its id at the endpoint, and
 * `--input-price` and `--output-price`, its list prices in USD per million tokens. None
 * of the three has a default, so that the spend of every run is stated rather than
 * assumed. `--cached-input-price` is the price of input read from the endpoint's cache,
 * the input price when left out. `--api responses|chat` picks the API, the Responses API
 * unless said otherwise: OpenAI's reasoning models take function tools through no other.
 * `--reasoning-effort` is passed to the model as given.
 */
export const CONNECTION_FLAGS: Flags = {
  model: { type: "string" },
  api: { type: "string", default: "responses" },
  "reasoning-effort": { type: "string" },
  "input-price": { type: "string" },
  "output-price": { type: "string" },
  "cached-input-price": { type: "string" },
};

/** The environment variables a connection needs. */
export const CONNECTION_ENV = ["OPENAI_API_KEY"] as const;

/** The connection `CONNECTION_FLAGS` describe. Throws for a flag that is missing or malformed. */
export function connectionOf(flags: FlagValues): Connection {
  const { model, api, "reasoning-effort": effort, "cached-input-price": cached } = flags;
  if (model === undefined) {
    throw new Error("Pass --model, the model's id at the endpoint");
  }
  if (api !== "responses" && api !== "chat") {
    throw new Error(`Pass --api responses or --api chat, not ${api}`);
  }
  const price = (name: "input-price" | "output-price" | "cached-input-price"): number => {
    const value = Number(flags[name] ?? Number.NaN);
    if (!(value >= 0)) {
      throw new Error(`Pass --${name}, the model's list price in USD per million tokens`);
    }
    return value;
  };
  return {
    model,
    api,
    ...(effort === undefined ? {} : { effort }),
    prices: {
      input: price("input-price"),
      output: price("output-price"),
      ...(cached === undefined ? {} : { cachedInput: price("cached-input-price") }),
    },
  };
}

const OPENAI = "https://api.openai.com/v1";

/**
 * What tells one connection's runs from another's: the suffix of a system's name, and
 * the settings its summary keeps.
 */
export function identityOf(connection: Connection): { suffix: string; config: object } {
  const { model, api, effort, prices } = connection;
  return {
    suffix: [model, ...(effort === undefined ? [] : [effort])]
      .join("-")
      .replaceAll(/[^\w.-]+/gu, "-"),
    config: {
      model,
      api,
      ...(effort === undefined ? {} : { effort }),
      baseUrl: connection.baseUrl ?? process.env["OPENAI_BASE_URL"] ?? OPENAI,
      prices,
    },
  };
}

/** One model turn: what it said and the tools it called. */
export type Turn = Readonly<{
  /** Its text, empty when it only called tools. */
  content: string;
  calls: readonly OpenAIToolCall[];
}>;

export class Conversation {
  requests = 0;
  inputTokens = 0;
  /** The input tokens the endpoint read from its cache, counted in `inputTokens` too. */
  cachedTokens = 0;
  outputTokens = 0;
  readonly #connection: Connection;
  readonly #instructions: string;
  readonly #items: Item[] = [];

  constructor(connection: Connection, instructions: string) {
    this.#connection = connection;
    this.#instructions = instructions;
  }

  /** Say `text` as the user and take the model's turn, offering `tools` when there are any. */
  async ask(text: string, tools: readonly OpenAITool[] = []): Promise<Turn> {
    this.#items.push(this.#wire.user(text));
    return await this.#turn(tools);
  }

  /**
   * Answer the tool calls of the model's last turn and take its next one. The API wants
   * every call of that turn answered.
   */
  async answer(
    results: readonly OpenAIToolMessage[],
    tools: readonly OpenAITool[] = [],
  ): Promise<Turn> {
    this.#items.push(...results.map((result) => this.#wire.result(result)));
    return await this.#turn(tools);
  }

  /** What the case has asked of the model so far, at the connection's prices. */
  usage(): Usage {
    const { model, prices } = this.#connection;
    const fresh = this.inputTokens - this.cachedTokens;
    return {
      model,
      requests: this.requests,
      inputTokens: this.inputTokens,
      usd:
        (fresh * prices.input +
          this.cachedTokens * (prices.cachedInput ?? prices.input) +
          this.outputTokens * prices.output) /
        1_000_000,
    };
  }

  get #wire(): (typeof WIRES)[keyof typeof WIRES] {
    return WIRES[this.#connection.api];
  }

  async #turn(tools: readonly OpenAITool[]): Promise<Turn> {
    const { model, effort, apiKey = process.env["OPENAI_API_KEY"] ?? "" } = this.#connection;
    const send = this.#connection.fetch ?? globalThis.fetch;
    const base = this.#connection.baseUrl ?? process.env["OPENAI_BASE_URL"] ?? OPENAI;
    const request = { model, effort, instructions: this.#instructions, items: this.#items, tools };
    const response = await retrying(
      async () =>
        await send(`${base}${this.#wire.path}`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(this.#wire.body(request)),
        }),
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${model} answered ${response.status}: ${body.slice(0, 300)}`);
    }
    const reading = this.#wire.read(await response.json());
    if (reading === undefined) {
      throw new Error(`${model} answered without a message`);
    }
    this.requests += 1;
    this.inputTokens += reading.tokens.input;
    this.cachedTokens += reading.tokens.cached;
    this.outputTokens += reading.tokens.output;
    this.#items.push(...reading.items);
    return { content: reading.content, calls: reading.calls };
  }
}
