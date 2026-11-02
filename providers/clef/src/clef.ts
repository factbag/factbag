import { systemOne } from "@factbag/system-one";
import type { Settings, SystemOne, SystemOneRequest, SystemOneResponse } from "@factbag/system-one";

/**
 * Clef settings. Requests go through `binding` when one is given, and otherwise to Cloudflare's
 * REST API. `batchSize` defaults to, and may not exceed, Workers AI's 64 questions per request.
 *
 * @beta
 */
export type Config = Settings & {
  /** The Clef model that answers, default `"clef-flash"`. */
  readonly model?: "clef" | "clef-flash";
  /** A Workers AI binding, such as `env.AI` inside a Worker. No credentials are read when set. */
  readonly binding?: {
    readonly run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
  };
  /** REST only: the Cloudflare account. Defaults to CLOUDFLARE_ACCOUNT_ID, read on the first request. */
  readonly accountId?: string;
  /** REST only: an API token with Workers AI access. Defaults to CLOUDFLARE_API_TOKEN, read on the first request. */
  readonly apiToken?: string;
  /** REST only: the fetch implementation, default the global `fetch`. Retries and timeouts belong here. */
  readonly fetch?: typeof globalThis.fetch;
};

/** Clef's own options: the shared settings left out of the flat config. */
type Options = Omit<Config, keyof Settings>;
type Model = NonNullable<Options["model"]>;
const MODELS: readonly string[] = ["clef", "clef-flash"] satisfies readonly Model[];

/** Classification and resolution over Clef, on Cloudflare Workers AI. */
export const clef: SystemOne<Options> = systemOne<Options>({
  name: "clef",
  // Workers AI rejects a Clef request with more than 64 questions.
  maxBatchSize: 64,
  defaultBatchSize: 64,
  connect: (options) => {
    const model = options.model ?? "clef-flash";
    if (!MODELS.includes(model)) {
      throw new Error(`model must be one of ${MODELS.join(", ")}, received ${model}`);
    }
    const send = options.binding ? viaBinding(options.binding, model) : viaRest(model, options);
    return async (request) => answers(await send({ model, ...request }));
  },
});

type Send = (body: SystemOneRequest & { model: Model }) => Promise<unknown>;

function viaBinding(binding: NonNullable<Options["binding"]>, model: Model): Send {
  return async (body) => await binding.run(`@cf/cloudflare/${model}`, body);
}

/**
 * POST to the account's Workers AI endpoint. Credentials not passed in are read from
 * CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN here, on the first request.
 */
function viaRest(
  model: Model,
  {
    accountId = environment("CLOUDFLARE_ACCOUNT_ID"),
    apiToken = environment("CLOUDFLARE_API_TOKEN"),
    fetch = globalThis.fetch,
  }: Partial<Options>,
): Send {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/cloudflare/${model}`;
  return async (body) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(
        `Workers AI rejected a ${model} request with ${response.status}: ${await response.text()}`,
      );
    }
    return unwrap(await response.json());
  };
}

/** The REST API wraps output in Cloudflare's envelope; a binding returns it bare. */
function unwrap(body: unknown): unknown {
  if (!isRecord(body) || !("success" in body)) {
    return body;
  }
  if (body["success"] !== true) {
    throw new Error(`Workers AI request failed: ${JSON.stringify(body["errors"] ?? body)}`);
  }
  return body["result"];
}

function answers(output: unknown): SystemOneResponse {
  return { answers: isRecord(output) ? output["answers"] : undefined };
}

function environment(name: string): string {
  const value = typeof process === "undefined" ? undefined : process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set; pass it in the config or use a Workers AI binding`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
