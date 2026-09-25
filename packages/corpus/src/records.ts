import type { ChunkReference, CorpusDocument, DocumentInput, Metadata, TextRange } from "./types";

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Expected an object");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function string(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string`);
  }
  return value;
}

export function makeDocument<M extends Metadata = Metadata>(
  value: DocumentInput<M>,
): CorpusDocument<M> {
  const input = record(value);
  const documentId = string(input["documentId"], "documentId");
  if (documentId.trim().length === 0) {
    throw new Error("documentId must not be empty");
  }
  const rawMetadata = record(input["metadata"] ?? {});
  if (
    Object.getPrototypeOf(rawMetadata) !== Object.prototype &&
    Object.getPrototypeOf(rawMetadata) !== null
  ) {
    throw new Error("Metadata must be a plain object");
  }
  const metadata: Partial<M> = value.metadata === undefined ? {} : { ...value.metadata };
  const rawSource = input["source"] === undefined ? undefined : record(input["source"]);
  const source =
    rawSource === undefined
      ? undefined
      : Object.freeze({
          uri: string(rawSource["uri"], "source.uri"),
          ...(rawSource["mediaType"] === undefined
            ? {}
            : { mediaType: string(rawSource["mediaType"], "source.mediaType") }),
        });
  return Object.freeze({
    documentId,
    text: string(input["text"], "text"),
    ...(input["title"] === undefined ? {} : { title: string(input["title"], "title") }),
    ...(source === undefined ? {} : { source }),
    metadata: Object.freeze(metadata),
  });
}

export function makeChunk(document: CorpusDocument, range: TextRange): ChunkReference {
  return Object.freeze({
    id: `${encodeURIComponent(document.documentId)}#${range.start}-${range.end}`,
    documentId: document.documentId,
    range: Object.freeze({ start: range.start, end: range.end }),
  });
}

/** Parse a chunk ID back into its document and range. Only the canonical spelling is accepted. */
export function parseChunkId(id: string): Readonly<{ documentId: string; range: TextRange }> {
  const match = /^([^#]+)#(0|[1-9]\d*)-(0|[1-9]\d*)$/u.exec(id);
  const [, encoded, start, end] = match ?? [];
  if (encoded === undefined || start === undefined || end === undefined) {
    throw new Error(`Invalid chunk ID: ${id}`);
  }
  let documentId: string;
  try {
    documentId = decodeURIComponent(encoded);
  } catch {
    throw new Error(`Invalid chunk ID: ${id}`);
  }
  if (encodeURIComponent(documentId) !== encoded) {
    throw new Error(`Invalid chunk ID: ${id}`);
  }
  return { documentId, range: { start: Number(start), end: Number(end) } };
}
