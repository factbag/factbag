# factbag

## 0.0.0-alpha.4

### Minor Changes

- 2814aab: Allow enumerations to hold numbers or dates as well as strings, with one member
  type per enumeration. Members must be unique; dates compare by instant and are
  copied on construction. NaN and invalid dates are rejected. Enumeration membership
  validation at assertion and query time is unchanged.
- 1f5bb1b: Classify predicates whose fields are number or Date enumerations, alongside
  string enumerations. Dates are sent to the model as ISO strings and retained as
  `Date` values in evidence. Open-ended `String`, `Number`, and `Date` fields
  remain unsupported.

## 0.0.0-alpha.3

### Minor Changes

- f8f2712: Add `eq` and `neq` rule-body comparisons for numbers, dates, strings, booleans, and entities. Entities compare by type and id rather than instance; dates compare by instant.
- 900b104: Add min, max, roundTo, floorTo, and ceilTo numeric arithmetic terms for rule bodies. Rounding supports whole-number decimal places (including negative places), with halves rounded away from zero. Decimal exponent shifting avoids multiplication artifacts at decimal rounding boundaries.
- 4f040e3: Add `daysBetween(later, earlier)` and `yearsBetween(later, earlier)` as number-valued arithmetic terms over dates. They count signed UTC calendar days and whole anniversary years, ignoring time of day; February 29 anniversaries fall on March 1 in common years. Numeric subtraction on variables now composes with other numeric operators.

### Patch Changes

- 01cc338: Speed up queries over large rulesets with linear-time recursive predicate grouping,
  per-query rule and evidence indexes, and judgment reuse during candidate discovery.
  Preserve candidate pruning and distinguish same-named predicate declarations when
  tracking active atoms, avoiding incorrect recursion cutoffs.
- 80d1e75: Share explanation nodes for reused proof judgments so explanation construction no longer grows with the number of paths through a shared proof. Identical sub-explanations are still listed once, and rendered content is unchanged.
- a074dab: Judge evidence-free, closed-world recursive components together as a least fixed
  point instead of enumerating recursive proof paths. Doubly recursive transitive
  closures and symmetric compositions no longer require exponential proof search.
  Other components retain the existing search semantics. Variable queries recognize
  a non-recursive disjunctive base case within an exclusive definition.

## 0.0.0-alpha.2

### Major Changes

- e212a94: Remove bigint support from predicate schemas, numeric expressions, aggregates, and numeric proof ranges. Numeric values now use JavaScript number exclusively, and an empty sum returns 0. The DSL rejects BigInt schemas and bigint operands rather than coercing them.

  Migrate BigInt fields to Number and bigint literals to numbers. Division now uses number semantics (fractional results rather than bigint truncation); values outside the safe integer range can lose precision. Date support is unchanged.

### Patch Changes

- bc114ed: Add npm alpha version, CI status, and license badges to the README.
- a3583ab: Publish the full project README on npm, including the document-to-conclusion walkthrough.

## 0.0.0-alpha.1

### Patch Changes

- ebc4a8a: A `letIn` or aggregate whose variable is already bound now constrains that variable instead of rebinding it. Before, a rule such as `tax(P, R) iff letIn(R, ...)` concluded `tax(alice, 99)` as true when its body computed 98, and an `or` branch evaluated under another branch's bindings reported those bindings as true. Proofs for such queries now carry a temporary variable and an `eq` comparison.
- eca65c2: An `or` is now judged per binding environment, so a branch that fails without binding a variable can no longer borrow the truth of a sibling branch whose bindings were discarded. Before, `and(or(p(X), r()), s(X))` could be judged true when `p(x1)` and `s(x3)` held but nothing satisfied both: the false `r()` branch produced an environment without `X`, the `or` was judged true there via `p(x1)`, and `s(X)` then ranged over every candidate. The recursion validator's edge collector also now carries variables bound in every `or` branch forward, matching the variable-use checker, so a comparison after such an `or` is no longer reported as unconstructive recursion.

## 0.0.0-alpha.0

Initial experimental distribution of core, corpus, guards, and Jev functionality.
