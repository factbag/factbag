---
"factbag": patch
---

Candidate derivation no longer throws "Primitive comparison operands must be bound" on a path an earlier conjunct has already failed. When `and(died(S, D), married_at(T, S, D))` finds no death, `D` stays unbound; deriving `married_at` candidates for the later subgoal evaluated its rule bodies as if the path were live, and a comparison on `D` in those bodies was reported as a programmer error. Those bodies are now evaluated as tolerant of unavailable bindings: the comparison is unknown and a head the body leaves unground yields no candidate. Live paths are unchanged.
