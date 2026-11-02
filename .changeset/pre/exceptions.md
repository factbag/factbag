---
"factbag": minor
---

**Breaking:** errors have their own entry point, `factbag/exceptions`. `ProgrammerError`, `ExclusiveDefinitionProgrammerError`, `PrimitiveArithmeticProgrammerError`, and `UnsafeUnboundVariableProgrammerError` move there from `factbag/kb`. `UnconstructiveRecursionProgrammerError`, which the solver raised but no entry point exported, is now exported too. `UnsupportedPredicateError` moves there from `factbag/jev/errors` and now extends `ProgrammerError`.
