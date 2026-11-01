---
"factbag": minor
---

Add `batchSize` to Jev's `Config`: how many questions each request holds. It defaults to 64 and has no upper limit. An invalid `batchSize` throws when the config is created or a run is built.

**Breaking:** each provider now has one entry point. Import `classifier`, `resolver`, `createConfig`, `Config`, and the `DEFAULT_*` constants from `factbag/jev`; `factbag/jev/classifier`, `factbag/jev/resolve`, `factbag/jev/config`, and `factbag/jev/errors` are removed.

Jev's `createConfig` now returns `Normalized & Config`, so `client` is no longer guaranteed on the result.

**Breaking:** errors have their own entry point, `factbag/exceptions`. `ProgrammerError`, `ExclusiveDefinitionProgrammerError`, `PrimitiveArithmeticProgrammerError`, and `UnsafeUnboundVariableProgrammerError` move there from `factbag/kb`. `UnconstructiveRecursionProgrammerError`, which the solver raised but no entry point exported, is now exported too. `UnsupportedPredicateError` moves there from `factbag/jev/errors` and now extends `ProgrammerError`.
