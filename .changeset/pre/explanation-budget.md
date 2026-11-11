---
"factbag": minor
---

Add a `budget` option to `explainJudgment`: the most claims to explain. The conclusion is always explained, then the claims that decided it before those that were evaluated and changed nothing, and those near the conclusion before those far from it. A claim that rests on claims left out names them, with their values, under `notShown`. Without a budget the whole proof is explained, as before; written as JSON a deep proof repeats each shared claim on every path to it, so give a budget when explaining a judgment in text.
