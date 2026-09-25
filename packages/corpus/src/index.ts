/**
 * Immutable documents and exact source chunks.
 *
 * @packageDocumentation
 */
export { Corpus } from "./corpus";
export * as chunkers from "./chunkers";
export type {
  Chunk,
  Chunker,
  ChunkReference,
  DocumentInput,
  CorpusDocument,
  DocumentReference,
  DocumentSource,
  Metadata,
  RecursiveChunkOptions,
  ResolvedChunk,
  TextRange,
} from "./types";
