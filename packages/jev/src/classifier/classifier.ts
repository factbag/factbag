import type { KnowledgeBase } from "@factbag/core/kb";
import type { Corpus, Metadata } from "@factbag/corpus";
import { chunkers } from "@factbag/corpus";
import { GuardedKB, guard } from "@factbag/guards";
import { classifiablePredicates } from "./classifiable-predicates";
import { extractEvidence } from "./extract-evidence";
import { resolveSettings } from "../settings";
import type { Config } from "../types/config";
import type { Run } from "../types/run";

/**
 * Validate available predicates eagerly and return a lazy iterator of executable jobs.
 * Bare KBs expose all known predicates; explicit guards retain their permission policy.
 * Only job.execute() makes a remote call. The consumer owns pacing and concurrency.
 * @beta
 */
export function classifier<M extends Metadata = Metadata>({
  corpus,
  input,
  config: inputConfig = {},
}: {
  corpus: Corpus<M>;
  input: KnowledgeBase | GuardedKB;
  config?: Config;
}): Run {
  // A bare KB carries no permission policy, so normalize it to unrestricted access.
  const baselineKB = (input instanceof GuardedKB ? input : guard(input).permit("*")).fork();
  const config = resolveSettings(inputConfig);
  const outputKB = baselineKB.kb.fork();
  const predicates = classifiablePredicates(baselineKB);
  // A conservative text budget, not a token count.
  const chunker = chunkers.recursive({ size: 8_000, overlap: 200 });
  const jobs = corpus
    .documents()
    .values()
    /** Skip chunking when no predicates can produce evidence. */
    .filter(() => predicates.length > 0)
    /** Chunk the construction-time document list only as jobs are requested. */
    .flatMap((document) => corpus.chunk(document, chunker))
    /** Each job classifies one chunk. */
    .map((chunk) => ({
      execute: async () =>
        await extractEvidence({
          chunk,
          predicates,
          config,
          kb: outputKB,
        }),
    }));
  return Object.assign(jobs, { kb: outputKB });
}
