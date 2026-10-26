---
"factbag": minor
---

Add opt-in staged routing to `classifier` at `factbag/jev/classifier` with `routing: { ... }`. Independent predicate and role-value relevance questions filter finite candidate domains before proposition classification and admission. Routed runs yield chunk plans with explicit pass barriers and inspection of routing decisions, candidate counts, and attempted requests. Routing is off by default: omitted or false preserves the flat, exhaustive job iterator. Filtering can reduce recall, and extra routing requests do not guarantee cost savings.
