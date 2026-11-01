import type { KnowledgeBase } from "@factbag/core/kb";
import type { Chunk, Corpus, Metadata } from "@factbag/corpus";
import { chunkers } from "@factbag/corpus";
import { GuardedKB, guard } from "@factbag/guards";
import { classifiablePredicates } from "./classifiable-predicates";
import type { ClassifiablePredicate } from "./types";
import { extractEvidence } from "./extract-evidence";
import { filterPredicates } from "./filter-predicates";
import { filterSymbols } from "./filter-symbols";
import type { Pipeline } from "../pipeline";
import type { Run } from "../types/run";

/**
 * Validate available predicates eagerly and return a lazy iterator of executable jobs.
 * Bare KBs expose all known predicates; explicit guards retain their permission policy.
 * Only job.execute() makes a remote call. The consumer owns pacing and concurrency.
 */
export function classifier<M extends Metadata = Metadata>({
  corpus,
  input,
  config,
}: {
  corpus: Corpus<M>;
  input: KnowledgeBase | GuardedKB;
  config: Pipeline;
}): Run {
  // A bare KB carries no permission policy, so normalize it to unrestricted access.
  const baselineKB = (input instanceof GuardedKB ? input : guard(input).permit("*")).fork();
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
    /** Each job runs the three classification stages for one chunk. */
    .map((chunk) => ({
      execute: async () =>
        await processChunk({
          chunk,
          predicates,
          config,
          kb: outputKB,
        }),
    }));
  return Object.assign(jobs, { kb: outputKB });
}

async function processChunk({
  chunk,
  predicates: inputPredicates,
  config,
  kb,
}: {
  chunk: Chunk;
  predicates: readonly ClassifiablePredicate[];
  config: Pipeline;
  kb: KnowledgeBase;
}): Promise<void> {
  const predicates = await filterPredicates({
    chunk,
    predicates: inputPredicates,
    config,
  });
  const symbols = await filterSymbols({ chunk, predicates, config });
  await extractEvidence({ chunk, predicates, symbols, config, kb });
}
