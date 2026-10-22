---
"factbag": patch
---

A `letIn` or aggregate whose variable is already bound now constrains that variable instead of rebinding it. Before, a rule such as `tax(P, R) iff letIn(R, ...)` concluded `tax(alice, 99)` as true when its body computed 98, and an `or` branch evaluated under another branch's bindings reported those bindings as true. Proofs for such queries now carry a temporary variable and an `eq` comparison.
