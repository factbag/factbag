import type { KnowledgeBase } from "@factbag/core/kb";

/** One opaque unit of work. Its effects are written to the run’s knowledge base. */
export type Job = {
  readonly execute: () => Promise<void>;
};

/** A single-cursor stream of jobs sharing an independent output knowledge base. */
export type Run = IterableIterator<Job> & {
  readonly kb: KnowledgeBase;
};
