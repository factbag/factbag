---
"factbag": minor
---

Add `factbag/clef`: classification and resolution over Cloudflare's Clef models on Workers AI. Pass a Workers AI binding such as `env.AI`, or use the REST API with `accountId` and `apiToken` (defaulting to `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, read on the first request). `model` selects `"clef-flash"` (default) or `"clef"`. Evidence is annotated under `clef`. The Clef entry point does not need the TypeSafe SDK.

Add `batchSize` to both providers' `Config`: how many questions each request holds. Jev defaults to 64 and sets no upper limit; Clef defaults to and is capped at Workers AI's 64. An invalid or over-limit `batchSize` throws when the config is created or a run is built. Resolution sends all of a contradiction's passages in one request, so with Clef a contradiction with more than 64 passages fails when its job runs, before anything is sent.

**Breaking:** each provider now has one entry point. Import `classifier`, `resolver`, `createConfig`, `Config`, and the `DEFAULT_*` constants from `factbag/jev`; `factbag/jev/classifier`, `factbag/jev/resolve`, `factbag/jev/config`, and `factbag/jev/errors` are removed.

Jev's `createConfig` now returns `Normalized & Config`, so `client` is no longer guaranteed on the result.

**Breaking:** errors have their own entry point, `factbag/exceptions`. `ProgrammerError`, `ExclusiveDefinitionProgrammerError`, `PrimitiveArithmeticProgrammerError`, and `UnsafeUnboundVariableProgrammerError` move there from `factbag/kb`. `UnconstructiveRecursionProgrammerError`, which the solver raised but no entry point exported, is now exported too. `UnsupportedPredicateError` moves there from `factbag/jev/errors` and now extends `ProgrammerError`.
