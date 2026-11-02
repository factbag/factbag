/**
 * Classification and resolution over Cloudflare's Clef models on Workers AI.
 *
 * @packageDocumentation
 */
import type { KnowledgeBase, GuardedKB } from "factbag/kb";
import type { Corpus, Metadata } from "factbag/corpus";
import type { Normalized, Run } from "@factbag/system-one";
import { clef } from "./clef";
import type { Config } from "./clef";
export {
  DEFAULT_AMBIGUITY_MARGIN,
  DEFAULT_CANDIDATE_PRODUCT_CUTOFF,
  DEFAULT_MINIMUM_PROBABILITY,
  DEFAULT_PREDICATE_THRESHOLD,
  DEFAULT_ROUTING_ENABLED,
  DEFAULT_SYMBOL_THRESHOLD,
} from "@factbag/system-one";
export type { Job, Normalized, Run, Settings } from "@factbag/system-one";
export type { Config } from "./clef";

/** Normalize settings once, sharing one connection when reused across runs. @beta */
export function createConfig(config?: Config): Normalized & Config {
  return clef.createConfig(config);
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
  return clef.classifier(input);
}

/**
 * Settle contradictions in a knowledge base by reading each one's evidence together.
 * Find every atom with evidence of both signs and return a lazy iterator of jobs, one per
 * contradiction. Each job sends all of the contradiction's passages to Clef in one request
 * and asks, for each passage, whether its account still stands. Evidence from superseded
 * passages is retracted from `kb`; the rest is kept, so the solver decides what the
 * surviving evidence means. The input KB is not modified. Throws during construction if
 * conflicting evidence has no source, and propagates corpus errors for sources that are not
 * resolvable chunk IDs. A contradiction with more than 64 passages fails when its job runs,
 * since Workers AI accepts at most 64 questions per request. The consumer owns pacing and
 * concurrency.
 * @beta
 */
export function resolver<M extends Metadata = Metadata>(
  corpus: Corpus<M>,
  kb: KnowledgeBase,
  config?: Config,
): Run {
  return clef.resolver(corpus, kb, config);
}
