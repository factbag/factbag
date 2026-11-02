import type { KnowledgeBase } from "@factbag/core/kb";
import type { Chunk, Corpus, Metadata } from "@factbag/corpus";
import { chunkers } from "@factbag/corpus";
import { GuardedKB, guard } from "@factbag/guards";
import { classifiablePredicates } from "./classifiable-predicates";
import type { ClassifiablePredicate, CreateChunkSymbolExtractor } from "./types";
import { extractEvidence } from "./extract-evidence";
import { extractSymbols } from "./extract-symbols";
import { filterPredicates } from "./filter-predicates";
import { filterSymbols } from "./filter-symbols";
import type { Pipeline } from "../pipeline";
import type { Run } from "../types/run";

/**
 * Validate available predicates eagerly and return a lazy iterator of executable jobs.
 * Bare KBs expose all known predicates; explicit guards retain their permission policy.
 * Only job.execute() makes a remote call. The consumer owns pacing and concurrency.
 * With `createChunkSymbolExtractor`, open-ended and entity fields also take the values
 * each chunk offers, so they need no finite domain up front.
 */
export function classifier<M extends Metadata = Metadata>({
  corpus,
  input,
  config,
  createChunkSymbolExtractor,
}: {
  corpus: Corpus<M>;
  input: KnowledgeBase | GuardedKB;
  config: Pipeline;
  createChunkSymbolExtractor?: CreateChunkSymbolExtractor | undefined;
}): Run {
  // A bare KB carries no permission policy, so normalize it to unrestricted access.
  const baselineKB = (input instanceof GuardedKB ? input : guard(input).permit("*")).fork();
  const outputKB = baselineKB.kb.fork();
  const predicates = classifiablePredicates(baselineKB, {
    extracting: createChunkSymbolExtractor !== undefined,
  });
  // A conservative text budget, not a token count.
  const chunker = chunkers.recursive({ size: 8_000, overlap: 200 });
  const jobs = corpus
    .documents()
    .values()
    /** Skip chunking when no predicates can produce evidence. */
    .filter(() => predicates.length > 0)
    /** Chunk the construction-time document list only as jobs are requested. */
    .flatMap((document) => corpus.chunk(document, chunker))
    /** Each job runs the classification stages for one chunk. */
    .map((chunk) => ({
      execute: async () =>
        await processChunk({
          chunk,
          predicates,
          createExtractor: createChunkSymbolExtractor,
          config,
          kb: outputKB,
        }),
    }));
  return Object.assign(jobs, { kb: outputKB });
}

async function processChunk({
  chunk,
  predicates: inputPredicates,
  createExtractor,
  config,
  kb,
}: {
  chunk: Chunk;
  predicates: readonly ClassifiablePredicate[];
  createExtractor: CreateChunkSymbolExtractor | undefined;
  config: Pipeline;
  kb: KnowledgeBase;
}): Promise<void> {
  const predicates = await extractSymbols({
    chunk,
    predicates: await filterPredicates({ chunk, predicates: inputPredicates, config }),
    createExtractor,
  });
  const symbols = await filterSymbols({ chunk, predicates, config });
  await extractEvidence({ chunk, predicates, symbols, config, kb });
}
