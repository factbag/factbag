import type { Provider } from "./provider";
import { isProbability } from "./utils";

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

/** How classification and resolution use a model's answers, whichever model gives them. @beta */
export type Settings = {
  /** Minimum probability for admitting signed evidence or retracting a passage, default 0.4. */
  readonly minimumProbability?: number;
  /** Classification: maximum gap from the strongest signed outcome. Resolution: required RETRACT lead over KEEP. Default 0. */
  readonly ambiguityMargin?: number;
  /** Enable heuristic predicate and symbol filtering, default false. */
  readonly routing?: boolean;
  /** Inclusive probability at which a predicate is kept for a passage, default 0.3. */
  readonly predicateThreshold?: number;
  /** Inclusive probability at which a symbol is kept for a passage, default 0.3. */
  readonly symbolThreshold?: number;
  /** Run symbol filtering if a retained predicate with non-Boolean roles exceeds this raw Cartesian product, default 16. */
  readonly candidateProductCutoff?: number;
  /** Questions per request when work can be split, up to the provider's limit. Defaults to the provider's choice. */
  readonly batchSize?: number;
};

/** Shared settings and one provider's own options, in one flat object. @beta */
export type Config<Options extends object> = Settings & Partial<Options>;

/** Settings with every default applied. @beta */
export type Normalized = Readonly<Required<Settings>>;

/** Apply defaults and validate every setting, so a bad value fails where it is written. */
export function normalize<Options extends object>(
  provider: Provider<Options>,
  config: Config<Options>,
): Normalized {
  const {
    minimumProbability = DEFAULT_MINIMUM_PROBABILITY,
    ambiguityMargin = DEFAULT_AMBIGUITY_MARGIN,
    routing = DEFAULT_ROUTING_ENABLED,
    candidateProductCutoff = DEFAULT_CANDIDATE_PRODUCT_CUTOFF,
    predicateThreshold = DEFAULT_PREDICATE_THRESHOLD,
    symbolThreshold = DEFAULT_SYMBOL_THRESHOLD,
    batchSize = provider.defaultBatchSize,
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
  batch(batchSize, provider);
  return {
    minimumProbability,
    ambiguityMargin,
    routing,
    candidateProductCutoff,
    predicateThreshold,
    symbolThreshold,
    batchSize,
  };
}

/** Reject a provider whose limits no configuration could satisfy. */
export function validateProvider<Options extends object>(provider: Provider<Options>): void {
  const { name, maxBatchSize, defaultBatchSize } = provider;
  if (maxBatchSize !== Infinity && !(Number.isSafeInteger(maxBatchSize) && maxBatchSize >= 1)) {
    throw new Error(`${name}: maxBatchSize must be a positive safe integer or Infinity`);
  }
  batch(defaultBatchSize, provider);
}

function threshold(value: number): void {
  if (!isProbability(value)) {
    throw new Error("Routing thresholds must be in [0, 1]");
  }
}

function batch<Options extends object>(
  value: number,
  { name, maxBatchSize }: Provider<Options>,
): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > maxBatchSize) {
    throw new RangeError(
      `batchSize must be an integer from 1 to ${maxBatchSize} for ${name}, received ${value}`,
    );
  }
}
