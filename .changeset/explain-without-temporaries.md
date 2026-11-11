---
"factbag": patch
---

Stop naming the solver's temporaries, such as `$tmp0`, in explanations. A nested arithmetic term is written as the term and its value, `mul(1000, 0.15) = 150`; a term that could not be computed stands in for its result wherever that is used, `gte(add(X, 1), 18) = unknown`; and a rule's `with ...` list gives only the rule's own variables.
