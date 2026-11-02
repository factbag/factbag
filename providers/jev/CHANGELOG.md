# @factbag/jev

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
