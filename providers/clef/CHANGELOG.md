# @factbag/clef

## 0.0.0-alpha.5

### Minor Changes

- e412626: Add `@factbag/clef`: classification and resolution over Cloudflare's Clef models on Workers AI. Pass a Workers AI binding such as `env.AI`, or use the REST API with `accountId` and `apiToken` (defaulting to `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, read on the first request). `model` selects `"clef-flash"` (default) or `"clef"`. Evidence is annotated under `clef`. Clef does not need the TypeSafe SDK.

  `batchSize` sets how many questions each request holds. It defaults to and is capped at Workers AI's 64. An invalid or over-limit `batchSize` throws when the config is created or a run is built. Resolution sends all of a contradiction's passages in one request, so a contradiction with more than 64 passages fails when its job runs, before anything is sent.

### Patch Changes

- Updated dependencies [19ac508]
- Updated dependencies [19ac508]
- Updated dependencies [dd3730b]
  - factbag@0.0.0-alpha.5
