/** Shared configuration for classification and resolution. @packageDocumentation */
import type { Config } from "./types/config";
import { isProbability } from "./utils";
export type { Config } from "./types/config";
import { TypeSafeClient } from "@typesafe-ai/sdk";

/** Default minimum probability for admitting signed evidence. @beta */
export const DEFAULT_MINIMUM_PROBABILITY = 0.4;

/** Default maximum probability gap from the strongest signed outcome. @beta */
export const DEFAULT_AMBIGUITY_MARGIN = 0;

// Recognize factory output so passing it to either workflow preserves its lazy client.
const normalized = new WeakMap<Config, Required<Config>>();

/** Normalize settings once, sharing a lazy SDK client when reused across runs. @beta */
export function createConfig(config: Config = {}): Required<Config> {
  const existing = normalized.get(config);
  if (existing) {
    return existing;
  }
  const {
    minimumProbability = DEFAULT_MINIMUM_PROBABILITY,
    ambiguityMargin = DEFAULT_AMBIGUITY_MARGIN,
  } = config;
  if (!isProbability(minimumProbability) || minimumProbability === 0) {
    throw new Error("minimumProbability must be in (0, 1]");
  }
  if (!isProbability(ambiguityMargin)) {
    throw new Error("ambiguityMargin must be in [0, 1]");
  }
  let client = config.client;
  const resolved = {
    minimumProbability,
    ambiguityMargin,
    get client() {
      return (client ??= new TypeSafeClient());
    },
  };
  normalized.set(resolved, resolved);
  return resolved;
}
