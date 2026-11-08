import type { SymbolExtractorConfig } from "./index";

const MODEL = "@cf/cloudflare/clairic";

/** How requests reach Clairic. */
type Connection = Pick<SymbolExtractorConfig, "binding" | "accountId" | "apiToken" | "fetch">;

/** Send one Clairic request and return its output, unwrapped from the REST envelope. */
export type Send = (inputs: Record<string, unknown>) => Promise<unknown>;

/** Credentials not passed in are read from the environment on the first request. */
export function connect(connection: Connection): Send {
  const { binding } = connection;
  if (binding !== undefined) {
    return async (inputs) => await binding.run(MODEL, inputs);
  }
  return async (inputs) => {
    const {
      accountId = environment("CLOUDFLARE_ACCOUNT_ID"),
      apiToken = environment("CLOUDFLARE_API_TOKEN"),
      fetch = globalThis.fetch,
    } = connection;
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      body: JSON.stringify(inputs),
    });
    if (!response.ok) {
      throw new Error(
        `Workers AI rejected a Clairic request with ${response.status}: ${await response.text()}`,
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

function environment(name: string): string {
  const value = typeof process === "undefined" ? undefined : process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set; pass it in the config or use a Workers AI binding`);
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
