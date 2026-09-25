# @factbag/corpus

Documents and exact source chunks. A chunk is an addressable
range of an immutable document. Its text is always an exact source slice:

```ts
chunk.text === document.text.slice(chunk.range.start, chunk.range.end);
```

The package has no runtime dependencies. `Corpus` is an in-memory store with a
synchronous API; it is not persisted. Adding text, splitting it, and
looking up a passage do not perform I/O. File reads and model calls remain async
in the application that uses it.

## Add documents and split them

```ts
import { Corpus, chunkers } from "@factbag/corpus";

const corpus = new Corpus();
const document = corpus.add({
  documentId: "license-register",
  text: "Alice currently holds an active medical license. Bob does not.",
  title: "Medical license register",
  source: { uri: "file:///records/register.txt", mediaType: "text/plain" },
  metadata: { jurisdiction: "Example State" },
});

const chunker = chunkers.recursive({ size: 8_000, overlap: 200 });
const chunks = corpus.chunk(document, chunker);

// Custom or manually selected ranges use the same identity and provenance model.
const selection = corpus.slice(document, { start: 0, end: 5 });
const resolved = corpus.resolve(selection.id);
resolved.chunk.text; // "Alice"
resolved.document.source; // original artifact location
```

`add(inputs)` also accepts an array, validating every input, including content
conflicts, before storing any. `documents()` lists every document in insertion
order, and `document(documentId)` reads one. Missing references throw descriptive
errors.

## Construct a chunker

```ts
const chunker = chunkers.recursive({ size: 800, overlap: 0 });
const ranges = chunker.split(document.text); // Iterable<TextRange>
const materialized = [...ranges];

chunkers.recursive({ size: 800, separators: ["\n\n", "\n", "; ", " "] });
```

- `chunkers.recursive()` is the sole built-in factory. It prefers the last available
  paragraph, line, then word separator within the hard size limit, falling back to
  complete grapheme boundaries. Separators stay in the original text. Custom
  separators are tried in order; an empty separator list uses grapheme boundaries.
- By default, size and overlap count Unicode grapheme clusters, so emoji,
  combining characters and CRLF pairs remain intact. Size can be as small as one.
- Overlap defaults to zero and must be smaller than size. Near separator
  boundaries the effective overlap can be smaller to ensure forward progress.
- Empty text produces no chunks. Splitters never normalize or trim the source.

Chunk IDs depend on the source ranges, not on the chunker name or implementation
version. Built-in chunks cover the original input without gaps.

### Custom size measurement

```ts
const chunker = chunkers.recursive({
  size: 6_000,
  overlap: 150,
  measure: (text) => tokenizer.encode(text).length,
});
```

With a model-compatible tokenizer, both limits above are token counts. `measure`
must be deterministic and return a nonnegative safe integer. The chunker measures
exact substrings rather than adding independently measured pieces. Size is a hard
bound; overlap is a maximum target that can shrink to allow forward progress.
If a single grapheme cannot fit, iteration raises `RangeError` rather than splitting
that grapheme or emitting an oversized chunk. Invalid measurements also throw.

### Lazy consumption

Both `chunker.split(text)` and `corpus.chunk(document, chunker)` are synchronous
iterables. Corpus validates the document reference when `chunk()` is called, but
does not invoke the splitter until iteration advances. The
built-in splitter indexes the current text's grapheme boundaries when iteration
starts, then computes each window on demand. Stopping consumption stops further
window generation. Use `[...corpus.chunk(document, chunker)]` when an array is needed.

### Custom splitters

```ts
import type { Chunker } from "@factbag/corpus";

const introduction: Chunker = {
  name: "introduction",
  split(text) {
    const end = text.indexOf("\n\n");
    return text.length === 0 ? [] : [{ start: 0, end: end < 0 ? text.length : end + 2 }];
  },
};

const chunks = corpus.chunk(document, introduction);
```

A chunker returns an `Iterable<TextRange>` synchronously; an array or generator
both satisfy the contract. Ranges must be nonempty, in bounds, on grapheme
boundaries, and have strictly increasing starts. Overlapping or selective ranges
are allowed. Corpus validates each range as it is consumed. If a
later range fails, previously yielded chunks remain valid and resolvable.

There is no async chunker API. File reads and other I/O belong to the application.

**Positions are UTF-16 code units**, matching JavaScript `String.slice`. Size and
overlap use graphemes or the custom measurement instead. `chunk()` and `slice()`
take a document, and positions are always absolute within it.

## Filtered views

`filter(predicate)` returns a view over the same storage, not a copy:

```ts
const prose = corpus.filter((document) => document.metadata["kind"] !== "structured");
prose.documents(); // matching documents only
```

- The filter is evaluated on read. Documents added later, through any handle,
  appear in the view when they match. `add` on a view writes to the shared storage.
- `document()`, `chunk()` and `slice()` throw for documents the view excludes.
- Filters compose: `view.filter(other)` requires both predicates.
- `resolve()` ignores the filter. A chunk ID is a global reference, so evidence
  resolves from any handle.

## Identity and immutability

- A document ID is caller-owned and identifies one immutable document.
- Re-adding identical content (text, title, source, and shallow-equal metadata)
  is idempotent. Re-adding the ID with different content throws, so citations
  keep resolving to the text that was originally consumed. Add changed content
  under a new document ID.
- A chunk ID is a pointer: the URI-encoded document ID, `#`, and the absolute
  range, e.g. `license-register#0-5`. The same passage has the same ID whether a
  chunker or `slice()` produced it, and `resolve()` accepts any valid pointer
  without the chunk having been produced first. Malformed or non-canonical IDs,
  unknown documents and invalid ranges throw.
- Identical text in different logical documents retains separate provenance.
- Document, source, chunk, and range records are frozen. The metadata record is
  shallow-copied and frozen; its values retain their identities. Nested objects,
  functions, and domain entities remain caller-owned and are not cloned or frozen.
- Metadata key order does not affect equality. Values are compared with `Object.is`:
  re-adding an object-valued annotation requires the same object reference.

## Typed metadata

Metadata is in-memory application data, not restricted to JSON. Its type parameter
defaults to `Metadata` (`Readonly<Record<string, unknown>>`):

```ts
const corpus = new Corpus<{ kind: string; reviewer: Person }>();
const document = corpus.add({
  documentId: "review",
  text: "Review notes...",
  metadata: { kind: "review", reviewer: alice },
});
document.metadata.reviewer === alice; // true; the original instance
corpus.filter(({ metadata }) => metadata.kind === "review");
```

The type is preserved by `add`, `document`, `documents`, filtered views, and
`resolve`. Metadata is optional on input and defaults to `{}`, so output fields
are typed as optional (`Readonly<Partial<M>>`). Treat nested values as read-only
while using the corpus, or explicitly snapshot them in the application. Persistence
or model adapters must choose their own serialization; Jev sends chunk text and
coordinates, not document metadata.

The source URI identifies the original artifact. Offsets refer to the supplied
text, not PDF coordinates, HTML DOM positions, or file bytes. Extract/normalize
content before ingestion. PDF/HTML loaders and extraction source maps can be
added separately; this version accepts text directly.

## Use with Jev

Jev's lazy classifier reads the whole corpus; only executing a job calls the model:

```ts
import { classifier } from "@factbag/jev/classifier";
import { guard } from "@factbag/guards";

const run = classifier(corpus, guard(kb).permit("assert", licensed), jevOptions);
for (const job of run) {
  await job.execute();
}
const enriched = run.kb;
```

The stored evidence's `source` is the chunk ID Jev read, resolvable through the
corpus.

## Checks

```sh
pnpm --filter @factbag/corpus test
pnpm --filter @factbag/corpus typecheck
```
