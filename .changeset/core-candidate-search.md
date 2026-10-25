---
"factbag": patch
---

Speed up queries over large rulesets with linear-time recursive predicate grouping,
per-query rule and evidence indexes, and judgment reuse during candidate discovery.
Preserve candidate pruning and distinguish same-named predicate declarations when
tracking active atoms, avoiding incorrect recursion cutoffs.
