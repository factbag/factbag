import { type KnowledgeBase, GuardedKB, guard } from "factbag/kb";
import { type Chunk, type Corpus, type Metadata, chunkers } from "factbag/corpus";
import { UnsupportedPredicateError } from "factbag/exceptions";
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
 * each chunk offers, so they need no finite domain up front. Without one, a predicate
 * with a field that has no values fails here.
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
  const predicates = classifiablePredicates(baselineKB);
  if (createChunkSymbolExtractor === undefined) {
    assertAskable(predicates);
  }
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

/**
 * Throw for the first predicate with a field that has no values. Without a symbol
 * extractor, fields hold only the values known up front, so such a predicate could never
 * be asked about.
 */
function assertAskable(predicates: readonly ClassifiablePredicate[]): void {
  for (const { declaration, roles } of predicates) {
    const name = emptyField({ declaration, roles });
    if (name === undefined) {
      continue;
    }
    const type = declaration.params[name];
    throw new UnsupportedPredicateError(
      type === String || type === Number || type === Date
        ? `Cannot classify predicate "${declaration.name}": field "${name}" has an unsupported open-ended domain. Use Boolean, enumeration(...), registered entities, or a symbol extractor.`
        : `No registered entities for ${declaration.name}.${name}`,
      declaration,
      name,
    );
  }
}

/** The first field, in declared order, with no values. */
function emptyField({
  declaration,
  roles,
}: Pick<ClassifiablePredicate, "declaration" | "roles">): string | undefined {
  return declaration.paramNames.find((name) => (roles[name] ?? []).length === 0);
}
