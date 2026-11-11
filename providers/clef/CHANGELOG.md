# @factbag/clef

## 0.0.0-alpha.6

### Minor Changes

- 6433c6b: Classify open-ended `String`, `Number`, and `Date` fields, and entity fields with no registered entities, over the values each passage offers. Pass `createChunkSymbolExtractor` to `classifier(...)` from `@factbag/jev` or `@factbag/clef` to build an extractor per chunk whose `query` answers candidate values for the open fields of the predicates it classifies. Both packages export the `ChunkSymbolExtractor`, `CreateChunkSymbolExtractor`, and `SymbolAnswer` types.

  Extracted values are candidates only. An extracted entity is registered in `run.kb.entities` when asserted or denied evidence mentions it; entities the model does not admit evidence for are discarded.

### Patch Changes

- Updated dependencies [7225a51]
- Updated dependencies [7f26b45]
- Updated dependencies [b7c85ff]
- Updated dependencies [ed6ec84]
- Updated dependencies [5114b2f]
- Updated dependencies [15391f2]
- Updated dependencies [eab3679]
- Updated dependencies [ecbd8d9]
- Updated dependencies [e4b343e]
  - factbag@0.0.0-alpha.6

## 0.0.0-alpha.5

### Minor Changes

- e412626: Add `@factbag/clef`: classification and resolution over Cloudflare's Clef models on Workers AI. Pass a Workers AI binding such as `env.AI`, or use the REST API with `accountId` and `apiToken` (defaulting to `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, read on the first request). `model` selects `"clef-flash"` (default) or `"clef"`. Evidence is annotated under `clef`. Clef does not need the TypeSafe SDK.

  `batchSize` sets how many questions each request holds. It defaults to and is capped at Workers AI's 64. An invalid or over-limit `batchSize` throws when the config is created or a run is built. Resolution sends all of a contradiction's passages in one request, so a contradiction with more than 64 passages fails when its job runs, before anything is sent.

### Patch Changes

- Updated dependencies [19ac508]
- Updated dependencies [19ac508]
- Updated dependencies [dd3730b]
  - factbag@0.0.0-alpha.5
