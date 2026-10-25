# Recursion

A rule can refer, directly or through other rules, to its own head predicate.
Predicates that reach one another form a recursive component. Query validation
requires every edge within that component to be positive: no negation or
aggregates over a member. Variable enumeration also requires ground evidence or
a non-recursive base rule or disjunctive alternative. Ground queries can evaluate
an unseeded positive cycle. See [negation](negation.md) for the validation boundary.

## Search with a loop check

By default, the solver proves a ground atom by evaluating its rules. If the atom
is already being proved, the solver judges it from its literals alone:
closed-world absence, or unknown in an open world. A judgment made under this cut
is valid only in that context. The cache therefore includes the active atoms.

When a recursive proof meets the same atom along several paths, every distinct
set of active atoms needs a separate proof. The work can grow exponentially with
the depth of recursion.

## Tabled components

A recursive component is _tabled_ when every member is closed-world and none has
a literal in the queried program. Denied literals exclude the component too.
The component's atoms are derived, never stated; evidence on lower predicates is
still allowed.

The solver judges these ground atoms together as a least fixed point. Each atom
enters its component's query-local table at closed-world absence when first read.
During evaluation, recursive reads return the table's current judgments and
record dependency edges instead of recursing. A changed value queues the atoms
that read it. The run ends when the queue is empty. Later requests in the same
query reuse settled atoms and add only the atoms they need.

The admitted positive operators are monotone on `⊥ < ? < ! < ⊤`, starting
from closed-world absence. Bodies use minimum and maximum, and an `if` rule
maps a false body to unknown. Atom evaluation sets unknown rule contributions
aside when definite contributions exist. Without own evidence, that combination
is monotone too. Iteration from bottom reaches the same least fixed point
regardless of evaluation order. This does not imply that all fixed points are
identical.

A value changes at most three times. A decrease or a fourth change is an invariant
violation and stops the query. This bounds changes per atom, not the number of ground
atoms: arithmetic that generates an unbounded domain remains outside any finite
termination guarantee.

A judgment cites immutable judgments as they stood when it was made. A newer
judgment can cite an earlier judgment of the same atom, but not vice versa.
Proofs remain finite directed acyclic graphs, not cyclic object references.

## What stays with the search

Evidence combined with rules is not monotone on that order. As rule contributions
move through `⊥ ? ! ⊤`, an asserted atom moves through `! ⊤ ! ⊤`.
A component with own evidence can therefore have multiple fixed points. An
open-world component also starts above bottom and can have multiple fixed points.

These components keep the existing active-set cache and literal-only loop cut,
including their entry-dependent answers. Non-recursive predicates also keep the
existing search. Tabling does not decide the semantics of evidence-bearing or
open-world cycles.
