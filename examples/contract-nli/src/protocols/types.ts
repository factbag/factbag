import type {
  Questions,
  RequestOptions,
  SystemOneRequest,
  SystemOneResult,
} from "@typesafe-ai/sdk";
import type { Contract, Hypothesis, Label } from "../data";

/** The SDK surface every protocol needs, so usage can be metered in one place. */
export type Client = Readonly<{
  systemOne: <Q extends Questions>(
    request: SystemOneRequest<Q>,
    options?: RequestOptions,
  ) => Promise<SystemOneResult<Q>>;
}>;

/** One contract's labels plus what it cost to get them. */
export type ContractResult = Readonly<{
  contractId: number;
  /** A hypothesis absent here had no valid answer and scores as wrong. */
  labels: Readonly<Record<string, Label>>;
  requests: number;
  inputTokens: number;
  latencyMs: number;
  /** Protocol-specific detail retained for offline analysis, such as probabilities. */
  detail: unknown;
}>;

export type Protocol = Readonly<{
  name: string;
  run: (contract: Contract, hypotheses: readonly Hypothesis[]) => Promise<ContractResult>;
}>;

export type Meter = { requests: number; inputTokens: number; outputTokens: number };

/** Wrap an SDK client so every request's token usage lands in `meter`. */
export function metered(client: Client, meter: Meter): Client {
  return {
    async systemOne(request, options) {
      const result = await client.systemOne(request, options);
      meter.requests += 1;
      // The SDK reports null when the API did not say.
      meter.inputTokens += result.usage.input_tokens ?? 0;
      meter.outputTokens += result.usage.output_tokens ?? 0;
      return result;
    },
  };
}
