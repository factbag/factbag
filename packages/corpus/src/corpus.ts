import type {
  Chunk,
  Chunker,
  ChunkReference,
  CorpusDocument,
  DocumentInput,
  DocumentReference,
  Metadata,
  ResolvedChunk,
  TextRange,
} from "./types";
import { makeChunk, makeDocument, parseChunkId } from "./records";
import { graphemeBoundaries, validateRange } from "./text";

type Storage<M extends Metadata> = Readonly<{ documents: Map<string, CorpusDocument<M>> }>;

/**
 * In-memory corpus of immutable documents and addressable source ranges.
 * {@link Corpus.filter} returns views over the same storage; the filter is evaluated on read.
 */
export class Corpus<M extends Metadata = Metadata> {
  #storage: Storage<M> = { documents: new Map() };
  #filter: (document: CorpusDocument<M>) => boolean = () => true;

  /**
   * Add a document to the shared storage; re-adding identical content is idempotent,
   * different content throws. On a view, the document is visible only if it matches.
   */
  add(input: DocumentInput<M>): CorpusDocument<M>;
  /** Validate every input, including conflicts, before storing any; then store them in input order. */
  add(inputs: readonly DocumentInput<M>[]): readonly CorpusDocument<M>[];
  add(
    input: DocumentInput<M> | readonly DocumentInput<M>[],
  ): CorpusDocument<M> | readonly CorpusDocument<M>[] {
    if (!isBatch(input)) {
      const document = makeDocument(input);
      const existing = this.#storage.documents.get(document.documentId);
      if (existing !== undefined) {
        assertSameContent(existing, document);
        return existing;
      }
      return this.store(document);
    }
    const pending = new Map<string, CorpusDocument<M>>();
    const documents = input.map((item) => {
      const document = makeDocument(item);
      const existing =
        pending.get(document.documentId) ?? this.#storage.documents.get(document.documentId);
      if (existing !== undefined) {
        assertSameContent(existing, document);
        return existing;
      }
      pending.set(document.documentId, document);
      return document;
    });
    for (const document of pending.values()) {
      this.store(document);
    }
    return Object.freeze(documents);
  }

  /** Read a document. Throws when absent or excluded by this view's filter. */
  document(documentId: string): CorpusDocument<M> {
    return this.requireVisible({ documentId });
  }

  /** List every document matching this view's filter, in insertion order. */
  documents(): readonly CorpusDocument<M>[] {
    return Object.freeze([...this.#storage.documents.values()].filter(this.#filter));
  }

  /**
   * Return a view over the same storage that also requires this predicate. Documents
   * added later through any view appear when they match.
   */
  filter(predicate: (document: CorpusDocument<M>) => boolean): Corpus<M> {
    const parent = this.#filter;
    const view = new Corpus<M>();
    view.#storage = this.#storage;
    view.#filter = (document) => parent(document) && predicate(document);
    return view;
  }

  /**
   * Split a document lazily, validating each range as it is consumed. If a later
   * range is invalid, earlier yielded chunks remain valid and resolvable.
   */
  chunk(target: DocumentReference, chunker: Chunker): Iterable<Chunk> {
    return this.splitDocument(this.requireVisible(target), chunker);
  }

  private *splitDocument(
    document: CorpusDocument,
    chunker: Chunker,
  ): Generator<Chunk, void, unknown> {
    const boundaries = new Set(graphemeBoundaries(document.text));
    let previousStart = -1;
    for (const range of chunker.split(document.text)) {
      validateRange(range, boundaries);
      if (range.start <= previousStart) {
        throw new Error("Chunker ranges must advance in source order");
      }
      previousStart = range.start;
      yield materialize(document, makeChunk(document, range));
    }
  }

  /** Select an exact range of a document. */
  slice(target: DocumentReference, selection: TextRange): Chunk {
    const document = this.requireVisible(target);
    validateRange(selection, new Set(graphemeBoundaries(document.text)));
    return materialize(document, makeChunk(document, selection));
  }

  /**
   * Resolve a chunk ID to its exact text and document. The ID encodes the document and
   * range, so any valid ID resolves while its document exists; resolution ignores this
   * view's filter. Throws for malformed IDs, unknown documents and invalid ranges.
   */
  resolve(chunkId: string): ResolvedChunk<M> {
    const { documentId, range } = parseChunkId(chunkId);
    const document = this.requireStored({ documentId });
    validateRange(range, new Set(graphemeBoundaries(document.text)));
    return Object.freeze({ chunk: materialize(document, makeChunk(document, range)), document });
  }

  private store(document: CorpusDocument<M>): CorpusDocument<M> {
    this.#storage.documents.set(document.documentId, document);
    return document;
  }

  private requireStored(reference: DocumentReference): CorpusDocument<M> {
    const document = this.#storage.documents.get(reference.documentId);
    if (document === undefined) {
      throw new Error(`Unknown document: ${reference.documentId}`);
    }
    return document;
  }

  private requireVisible(reference: DocumentReference): CorpusDocument<M> {
    const document = this.requireStored(reference);
    if (!this.#filter(document)) {
      throw new Error(`Document "${document.documentId}" is excluded by this corpus view`);
    }
    return document;
  }
}

function materialize(document: CorpusDocument, reference: ChunkReference): Chunk {
  return Object.freeze({
    ...reference,
    text: document.text.slice(reference.range.start, reference.range.end),
  });
}

function assertSameContent(existing: CorpusDocument, document: CorpusDocument): void {
  const keys = Object.keys(existing.metadata);
  if (
    existing.text !== document.text ||
    existing.title !== document.title ||
    existing.source?.uri !== document.source?.uri ||
    existing.source?.mediaType !== document.source?.mediaType ||
    keys.length !== Object.keys(document.metadata).length ||
    !keys.every(
      (key) =>
        Object.hasOwn(document.metadata, key) &&
        Object.is(existing.metadata[key], document.metadata[key]),
    )
  ) {
    throw new Error(`Document "${document.documentId}" already exists with different content`);
  }
}

function isBatch<M extends Metadata>(
  input: DocumentInput<M> | readonly DocumentInput<M>[],
): input is readonly DocumentInput<M>[] {
  return Array.isArray(input);
}
