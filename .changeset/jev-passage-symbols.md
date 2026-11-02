---
"factbag": minor
---

Classify open-ended `String`, `Number`, and `Date` fields, and entity fields with no registered entities, over the values each passage offers. Pass `createChunkSymbolExtractor` to `classifier(...)` from `factbag/jev` or `factbag/clef` to build an extractor per chunk whose `query` answers candidate values for the open fields of each retained predicate. Both entry points export the `ChunkSymbolExtractor`, `CreateChunkSymbolExtractor`, and `SymbolAnswer` types.

Extracted values are candidates only. An extracted entity is registered in `run.kb.entities` when asserted or denied evidence mentions it; entities the model does not admit evidence for are discarded.
