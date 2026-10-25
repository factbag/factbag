---
"factbag": patch
---

An `or` is now judged per binding environment, so a branch that fails without binding a variable can no longer borrow the truth of a sibling branch whose bindings were discarded. Before, `and(or(p(X), r()), s(X))` could be judged true when `p(x1)` and `s(x3)` held but nothing satisfied both: the false `r()` branch produced an environment without `X`, the `or` was judged true there via `p(x1)`, and `s(X)` then ranged over every candidate. The recursion validator's edge collector also now carries variables bound in every `or` branch forward, matching the variable-use checker, so a comparison after such an `or` is no longer reported as unconstructive recursion.
