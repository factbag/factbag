/**
 * Parse corpus evidence into a new knowledge base using guarded predicate operations.
 *
 * @packageDocumentation
 */
import type { KnowledgeBase } from "@factbag/core/kb";
import type { Corpus, Metadata } from "@factbag/corpus";
import { chunkers } from "@factbag/corpus";
import type { Chunk, DocumentReference } from "@factbag/corpus";
import { GuardedKB, guard } from "@factbag/guards";
import { jevClient } from "./client";
import { admissionPolicy, createJob } from "./jobs";
import type { ClassificationJob, RequestConfig } from "./jobs";
import { prepareTools } from "./tools";

export type { ClassifierClient, ClassificationQuestions } from "./client";
export type { AdmissionPolicy, Assessment, ClassificationJob, RequestConfig } from "./jobs";
export type { EvidenceChoice, Outcome, SupportedField, SupportedPredicate } from "./types";

/**
 * A single-cursor stream of jobs and their shared, independently stored output.
 *
 * @beta
 */
export type ClassificationRun = IterableIterator<ClassificationJob> & {
  /** Independent output KB. Successful jobs add evidence to it in completion order. */
  readonly kb: KnowledgeBase;
};

/**
 * Validate available tools eagerly and return a lazy iterator of executable jobs.
 * Bare KBs expose all known predicates; explicit guards retain their permission policy.
 * Only job.execute() makes a remote call. The consumer owns pacing and concurrency.
 * @beta
 */
export function classifier<M extends Metadata = Metadata>(
  corpus: Corpus<M>,
  input: KnowledgeBase | GuardedKB,
  config: RequestConfig = {},
): ClassificationRun {
  const admission = admissionPolicy(config.admission);
  // A bare KB carries no permission policy, so normalize it to unrestricted access.
  const baseline = (input instanceof GuardedKB ? input : guard(input).permit("*")).fork();
  const tools = prepareTools(baseline);
  const output = baseline.kb.fork();
  // The whole corpus, as its documents at construction time.
  const documents = corpus.documents();
  const jobContext = {
    client: jevClient(config.client),
    output,
    admission,
  };

  function* jobs(): Generator<ClassificationJob, void, unknown> {
    if (tools.length === 0) {
      return;
    }
    for (const chunk of chunks(corpus, documents)) {
      for (const tool of tools) {
        yield createJob(chunk, tool, jobContext);
      }
    }
  }

  return Object.assign(jobs(), { kb: output });
}

function* chunks<M extends Metadata>(
  corpus: Corpus<M>,
  documents: readonly DocumentReference[],
): Generator<Chunk, void, unknown> {
  // A conservative text budget, not a token count. Jev 1.13 permits 32k tokens
  // for state + longest question and 64k overall: https://docs.typesafe.ai/models
  const chunker = chunkers.recursive({ size: 8_000, overlap: 200 });
  for (const document of documents) {
    yield* corpus.chunk(document, chunker);
  }
}
