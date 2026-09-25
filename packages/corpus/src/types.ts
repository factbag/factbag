/** Application-defined metadata. Values may include native objects and functions. */
export type Metadata = Readonly<Record<string, unknown>>;

/** A half-open range, measured in JavaScript UTF-16 code units. */
export type TextRange = Readonly<{ start: number; end: number }>;

/** Location of the original artifact; text offsets refer to the stored text, not file bytes. */
export type DocumentSource = Readonly<{ uri: string; mediaType?: string }>;

/** Text supplied by the caller, after any file extraction or normalization. */
export type DocumentInput<M extends Metadata = Metadata> = Readonly<{
  documentId: string;
  text: string;
  title?: string;
  source?: DocumentSource;
  metadata?: M;
}>;

/** Identifies one immutable document. */
export type DocumentReference = Readonly<{ documentId: string }>;

/** An immutable document. Re-adding its ID with different content is rejected. */
export type CorpusDocument<M extends Metadata = Metadata> = DocumentReference &
  Readonly<{
    text: string;
    title?: string;
    source?: DocumentSource;
    /** Shallow snapshot; nested values retain identity and remain caller-owned. */
    metadata: Readonly<Partial<M>>;
  }>;

/** A stable source range; its ID depends only on the document and absolute range. */
export type ChunkReference = DocumentReference & Readonly<{ id: string; range: TextRange }>;

/** A source range with text materialized for convenient consumption by models or UIs. */
export type Chunk = ChunkReference & Readonly<{ text: string }>;

/** A resolved chunk together with its complete document. */
export type ResolvedChunk<M extends Metadata = Metadata> = Readonly<{
  chunk: Chunk;
  document: CorpusDocument<M>;
}>;

/** Synchronous segmentation into source-ordered ranges relative to the supplied text. */
export type Chunker = Readonly<{
  name: string;
  split: (text: string) => Iterable<TextRange>;
}>;

/** Bounded recursive splitting; size and overlap use grapheme counts unless measure is supplied. */
export type RecursiveChunkOptions = Readonly<{
  /** Positive integer maximum size of each emitted substring. */
  size: number;
  /** Desired maximum overlap, smaller than size. Defaults to zero. */
  overlap?: number;
  /** Deterministic nonnegative integer size of a substring, e.g. an exact tokenizer's count. */
  measure?: (text: string) => number;
  /** Preferred separators, in order. Defaults to paragraphs, lines, then words. */
  separators?: readonly string[];
}>;
