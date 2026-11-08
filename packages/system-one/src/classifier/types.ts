import type { Entity, PredicateDeclaration, Scalar } from "factbag/dsl";
import type { Chunk } from "factbag/corpus";
import type { Operation } from "factbag/kb";

/** A permitted effect on a validated predicate: any guarded operation that writes. */
export type Action = Exclude<Operation, "query">;

/**
 * A predicate the classifier may write evidence for: its declaration, the signs its guard
 * permits, and the finite values each role can take.
 */
export type ClassifiablePredicate = {
  readonly declaration: PredicateDeclaration;
  readonly actions: ReadonlySet<Action>;
  readonly roles: Readonly<Record<string, readonly (Scalar | Entity)[]>>;
};

/**
 * Candidate values for each requested field, by predicate and then by field name. Open
 * fields are `String`, `Number`, `Date`, and entity fields. The same value may be offered
 * to any number of fields.
 * @beta
 */
export type SymbolAnswer = ReadonlyMap<
  PredicateDeclaration,
  Readonly<Record<string, readonly (Scalar | Entity)[]>>
>;

/**
 * Candidate symbols found in a fixed set of chunks. How and when it reads them, and what
 * it caches between queries, is up to the implementation. An entity's type and id are its
 * identity, so the ids it mints decide which mentions are the same entity.
 * @beta
 */
export type ChunkSymbolExtractor = {
  /** Candidate values for exactly the requested fields of each requested predicate. */
  readonly query: (
    requests: ReadonlyMap<PredicateDeclaration, readonly string[]>,
  ) => SymbolAnswer | Promise<SymbolAnswer>;
};

/** Build an extractor over the chunks it will be queried about. @beta */
export type CreateChunkSymbolExtractor = (chunks: readonly Chunk[]) => ChunkSymbolExtractor;
