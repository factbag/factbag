---
"factbag": minor
---

**Breaking:** each provider now has one entry point. Import `classifier`, `resolver`, `createConfig`, `Config`, and the `DEFAULT_*` constants from `factbag/jev`; `factbag/jev/classifier`, `factbag/jev/resolve`, `factbag/jev/config`, and `factbag/jev/errors` are removed.

**Breaking:** errors have their own entry point, `factbag/exceptions`. `ProgrammerError`, `ExclusiveDefinitionProgrammerError`, `PrimitiveArithmeticProgrammerError`, and `UnsafeUnboundVariableProgrammerError` move there from `factbag/kb`. `UnconstructiveRecursionProgrammerError`, which the solver raised but no entry point exported, is now exported too. `UnsupportedPredicateError` moves there from `factbag/jev/errors` and now extends `ProgrammerError`.
