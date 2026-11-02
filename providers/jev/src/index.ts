/**
 * Classification and resolution over TypeSafe's Jev.
 *
 * @packageDocumentation
 */
import type { KnowledgeBase, GuardedKB } from "factbag/kb";
import type { Corpus, Metadata } from "factbag/corpus";
import { systemOne } from "@factbag/system-one";
import type { Normalized, Run, Settings, SystemOne } from "@factbag/system-one";
import { TypeSafeClient } from "@typesafe-ai/sdk";
export {
  DEFAULT_AMBIGUITY_MARGIN,
  DEFAULT_CANDIDATE_PRODUCT_CUTOFF,
  DEFAULT_MINIMUM_PROBABILITY,
  DEFAULT_PREDICATE_THRESHOLD,
  DEFAULT_ROUTING_ENABLED,
  DEFAULT_SYMBOL_THRESHOLD,
} from "@factbag/system-one";
export type { Job, Normalized, Run, Settings } from "@factbag/system-one";

/**
 * Jev settings. Model, timeout, and retry settings belong to the SDK client. `batchSize`
 * defaults to 64 questions per request; TypeSafe sets no upper limit.
 *
 * @beta
 */
export type Config = Settings & {
  /** Defaults to a lazy TypeSafeClient configured from TYPESAFE_* environment variables. */
  readonly client?: TypeSafeClient;
};

const jev: SystemOne<{ client: TypeSafeClient }> = systemOne({
  name: "jev",
  // TypeSafe limits a request by its context, not by how many questions it holds.
  maxBatchSize: Infinity,
  /**
   * Accuracy holds to roughly a hundred candidates and then falls away: at several hundred
   * Jev starts attributing a document's facts to candidates it does not mention. Splitting
   * costs requests, and resends the passage, but keeps each request about a readable shortlist.
   */
  defaultBatchSize: 64,
  // Reading TYPESAFE_* waits for the first request, so building a run never builds a client.
  connect:
    ({ client = new TypeSafeClient() }) =>
    async (request) =>
      await client.systemOne(request),
});

/** Normalize settings once, sharing a lazy SDK client when reused across runs. @beta */
export function createConfig(config?: Config): Normalized & Config {
  return jev.createConfig(config);
}

/**
 * Parse corpus evidence into a new knowledge base using guarded predicate operations.
 * Validate available predicates eagerly and return a lazy iterator of executable jobs.
 * Bare KBs expose all known predicates; explicit guards retain their permission policy.
 * Only job.execute() makes a remote call. The consumer owns pacing and concurrency.
 * @beta
 */
export function classifier<M extends Metadata = Metadata>(input: {
  corpus: Corpus<M>;
  input: KnowledgeBase | GuardedKB;
  config?: Config;
}): Run {
  return jev.classifier(input);
}

/**
 * Settle contradictions in a knowledge base by reading each one's evidence together.
 * Find every atom with evidence of both signs and return a lazy iterator of jobs, one per
 * contradiction. Each job sends all of the contradiction's passages to Jev in one request
 * and asks, for each passage, whether its account still stands. Evidence from superseded
 * passages is retracted from `kb`; the rest is kept, so the solver decides what the
 * surviving evidence means. The input KB is not modified. Throws during construction if
 * conflicting evidence has no source, and propagates corpus errors for sources that are not
 * resolvable chunk IDs. The consumer owns pacing and concurrency.
 * @beta
 */
export function resolver<M extends Metadata = Metadata>(
  corpus: Corpus<M>,
  kb: KnowledgeBase,
  config?: Config,
): Run {
  return jev.resolver(corpus, kb, config);
}
