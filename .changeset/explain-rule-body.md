---
"factbag": patch
---

Rest a rule application directly on the subgoals of its body in explanations. When a rule's body is an `and` or an `or`, the explanation no longer has a node that restates the body between the rule and its subgoals: the rule's `given` lists the subgoals themselves. A compound nested inside a body is still its own node, and so is a body that is a single atom or a negation.
