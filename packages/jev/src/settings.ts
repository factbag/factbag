import { createConfig } from "./config";
import { jev } from "./jev/model";
import type { Model } from "./types/model";
import type { Config } from "./types/config";

/**
 * Validated settings as the pipeline sees them: every default applied, and a model in
 * place of the client it talks through, so no stage can reach past the model to the SDK.
 */
export type Settings = Readonly<Omit<Required<Config>, "client">> & { readonly model: Model };

/** Resolve public configuration into pipeline settings backed by Jev. */
export function resolveSettings(input: Config = {}): Settings {
  const config = createConfig(input);
  return {
    minimumProbability: config.minimumProbability,
    ambiguityMargin: config.ambiguityMargin,
    // Defer reading the client to the first request, so building a run never builds an SDK client.
    model: jev(() => config.client),
  };
}
