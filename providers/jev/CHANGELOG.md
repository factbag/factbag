# @factbag/jev

## 0.1.0-alpha.7

### Patch Changes

- factbag@0.1.0-alpha.7

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

- 19ac508: **Breaking:** Jev moves from `factbag/jev` to its own package, `@factbag/jev`. Install it alongside `factbag` and `@typesafe-ai/sdk`, which is now a required peer dependency at `^0.7.0`, and import `classifier`, `resolver`, `createConfig`, `Config`, and the `DEFAULT_*` constants from `@factbag/jev`. `factbag` no longer has a Jev entry point or an SDK peer dependency. `@factbag/jev` and `@factbag/clef` are released together with `factbag` and require the same `factbag` version.

  **Breaking:** `@factbag/jev` has a single entry point. `factbag/jev/classifier`, `factbag/jev/resolve`, `factbag/jev/config`, and `factbag/jev/errors` have no replacement subpaths.

  Add `batchSize` to Jev's `Config`: how many questions each request holds. It defaults to 64 and has no upper limit. An invalid `batchSize` throws when the config is created or a run is built.

  Jev's `createConfig` now returns `Normalized & Config`, so `client` is no longer guaranteed on the result.

### Patch Changes

- Updated dependencies [19ac508]
- Updated dependencies [19ac508]
- Updated dependencies [dd3730b]
  - factbag@0.0.0-alpha.5

## 0.1.0-next.0

### Minor Changes

- Publish the initial experimental Factbag packages with native Node ESM artifacts and declarations.

### Patch Changes

- Updated dependencies
  - @factbag/core@0.1.0-next.0
  - @factbag/corpus@0.1.0-next.0
  - @factbag/guards@0.1.0-next.0
