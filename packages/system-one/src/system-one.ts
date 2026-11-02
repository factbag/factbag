import type { KnowledgeBase } from "@factbag/core/kb";
import type { Corpus, Metadata } from "@factbag/corpus";
import type { GuardedKB } from "@factbag/guards";
import { classifier } from "./classifier/classifier";
import { normalize, validateProvider } from "./config";
import type { Config, Normalized } from "./config";
import { systemOneModel } from "./model/model";
import type { CreateChunkSymbolExtractor } from "./classifier/types";
import type { Pipeline } from "./pipeline";
import type { Provider, Transport } from "./provider";
import { resolver } from "./resolve";
import type { Run } from "./types/run";

/**
 * Classification and resolution bound to one provider. Each accepts the provider's flat
 * `Config`: shared settings beside the provider's own options.
 *
 * @beta
 */
export type SystemOne<Options extends object> = {
  /**
   * Validate settings now and capture the options as written. Passing the result to either
   * workflow shares one lazily built transport across runs; passing it back returns it as is.
   */
  readonly createConfig: (config?: Config<Options>) => Normalized & Partial<Options>;

  /**
   * Validate available predicates eagerly and return a lazy iterator of executable jobs, one
   * per chunk. Bare KBs expose all known predicates; explicit guards retain their permission
   * policy. Only `job.execute()` makes a remote call. The consumer owns pacing and concurrency.
   * With `createChunkSymbolExtractor`, open-ended and entity fields also take the values each
   * chunk offers, so they need no finite domain up front.
   */
  readonly classifier: <M extends Metadata = Metadata>(input: {
    corpus: Corpus<M>;
    input: KnowledgeBase | GuardedKB;
    config?: Config<Options>;
    createChunkSymbolExtractor?: CreateChunkSymbolExtractor;
  }) => Run;

  /**
   * Find every atom with evidence of both signs and return a lazy iterator of jobs, one per
   * contradiction. Each job sends all of the contradiction's passages to the model in one
   * request, so a contradiction with more passages than the provider's limit fails when run.
   * Evidence from superseded passages is retracted from a fork of `kb`; the input KB is not
   * modified. Throws during construction if conflicting evidence has no source.
   */
  readonly resolver: <M extends Metadata = Metadata>(
    corpus: Corpus<M>,
    kb: KnowledgeBase,
    config?: Config<Options>,
  ) => Run;
};

/**
 * Bind classification and resolution to a provider. Throws if the provider's batch limits
 * are inconsistent, so a misdeclared provider fails when its package loads.
 *
 * @beta
 */
export function systemOne<Options extends object>(provider: Provider<Options>): SystemOne<Options> {
  validateProvider(provider);
  // Recognize factory output, so reusing it shares its pipeline and its lazy transport.
  const created = new WeakMap<object, Normalized & Partial<Options>>();
  const pipelines = new WeakMap<object, Pipeline>();

  function pipeline(config: Config<Options> = {}): Pipeline {
    const existing = pipelines.get(config);
    if (existing) {
      return existing;
    }
    // Snapshot the options as written, so later mutation changes neither settings nor transport.
    const options = { ...config };
    const settings = normalize(provider, options);
    let transport: Transport | undefined;
    return {
      ...settings,
      model: systemOneModel({
        name: provider.name,
        batchSize: settings.batchSize,
        maxBatchSize: provider.maxBatchSize,
        transport: () => (transport ??= provider.connect(options)),
      }),
    };
  }

  return {
    createConfig(config = {}) {
      const existing = created.get(config);
      if (existing) {
        return existing;
      }
      const resolved = pipeline(config);
      const normalized = {
        ...config,
        minimumProbability: resolved.minimumProbability,
        ambiguityMargin: resolved.ambiguityMargin,
        routing: resolved.routing,
        candidateProductCutoff: resolved.candidateProductCutoff,
        predicateThreshold: resolved.predicateThreshold,
        symbolThreshold: resolved.symbolThreshold,
        batchSize: resolved.batchSize,
      };
      created.set(normalized, normalized);
      pipelines.set(normalized, resolved);
      return normalized;
    },
    classifier: ({ corpus, input, config, createChunkSymbolExtractor }) =>
      classifier({ corpus, input, config: pipeline(config), createChunkSymbolExtractor }),
    resolver: (corpus, kb, config) => resolver(corpus, kb, pipeline(config)),
  };
}
