/** Shared configuration for classification and resolution. @packageDocumentation */
import type { Config } from "./types/config";
import { isProbability } from "./utils";
export type { Config } from "./types/config";
import { TypeSafeClient } from "@typesafe-ai/sdk";

/** Default minimum probability for admitting signed evidence. @beta */
export const DEFAULT_MINIMUM_PROBABILITY = 0.4;

/** Default maximum probability gap from the strongest signed outcome. @beta */
export const DEFAULT_AMBIGUITY_MARGIN = 0;

/** Whether heuristic predicate and symbol filtering is enabled by default. @beta */
export const DEFAULT_ROUTING_ENABLED = false;

/** Default inclusive probability threshold for retaining a predicate. @beta */
export const DEFAULT_PREDICATE_THRESHOLD = 0.3;

/** Default inclusive probability threshold for retaining a symbol. @beta */
export const DEFAULT_SYMBOL_THRESHOLD = 0.3;

/** Default candidate product size above which symbol filtering runs. @beta */
export const DEFAULT_CANDIDATE_PRODUCT_CUTOFF = 16;

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
    routing = DEFAULT_ROUTING_ENABLED,
    candidateProductCutoff = DEFAULT_CANDIDATE_PRODUCT_CUTOFF,
    predicateThreshold = DEFAULT_PREDICATE_THRESHOLD,
    symbolThreshold = DEFAULT_SYMBOL_THRESHOLD,
  } = config;
  if (!isProbability(minimumProbability) || minimumProbability === 0) {
    throw new Error("minimumProbability must be in (0, 1]");
  }
  if (!isProbability(ambiguityMargin)) {
    throw new Error("ambiguityMargin must be in [0, 1]");
  }
  // Validate routing settings even while routing is off, so a bad value fails where it is written.
  if (!Number.isSafeInteger(candidateProductCutoff) || candidateProductCutoff < 0) {
    throw new Error("candidateProductCutoff must be a nonnegative safe integer");
  }
  threshold(predicateThreshold);
  threshold(symbolThreshold);
  let client = config.client;
  const resolved = {
    minimumProbability,
    ambiguityMargin,
    routing,
    candidateProductCutoff,
    predicateThreshold,
    symbolThreshold,
    get client() {
      return (client ??= new TypeSafeClient());
    },
  };
  normalized.set(resolved, resolved);
  return resolved;
}

function threshold(value: number): void {
  if (!isProbability(value)) {
    throw new Error("Routing thresholds must be in [0, 1]");
  }
}
