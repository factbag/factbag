import type { KnowledgeBase } from "factbag/kb";

/** One opaque unit of work. Its effects are written to the run’s knowledge base. @beta */
export type Job = {
  readonly execute: () => Promise<void>;
};

/** A single-cursor stream of jobs sharing an independent output knowledge base. @beta */
export type Run = IterableIterator<Job> & {
  readonly kb: KnowledgeBase;
};
