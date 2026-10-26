/**
 * Wrap the TypeSafe SDK so every request's token usage lands in a meter, and price it.
 */
import type {
  Questions,
  RequestOptions,
  SystemOneRequest,
  SystemOneResult,
  TypeSafeClient,
} from "@typesafe-ai/sdk";

/** Jev list price: USD 0.042 per million input tokens, output free. */
export const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

export type Meter = { requests: number; inputTokens: number; outputTokens: number };

export function meter(): Meter {
  return { requests: 0, inputTokens: 0, outputTokens: 0 };
}

/** The metered SDK: any System One question, which covers the classifier's contract. */
export type MeteredClient = {
  readonly systemOne: <const Q extends Questions>(
    request: SystemOneRequest<Q>,
    options?: RequestOptions,
  ) => Promise<SystemOneResult<Q>>;
};

export function metered(sdk: TypeSafeClient, usage: Meter): MeteredClient {
  return {
    async systemOne<const Q extends Questions>(
      request: SystemOneRequest<Q>,
      options?: RequestOptions,
    ): Promise<SystemOneResult<Q>> {
      const result = await sdk.systemOne(request, options);
      usage.requests += 1;
      // The SDK reports null when the API did not say.
      usage.inputTokens += result.usage.input_tokens ?? 0;
      usage.outputTokens += result.usage.output_tokens ?? 0;
      return result;
    },
  };
}
