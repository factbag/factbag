# @factbag/guards

Create a permission-enforcing view over an existing knowledge base. `GuardedKB`
uses composition: it shares the underlying KB and checks each exposed operation
before delegating to core.

```ts
import { predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { guard } from "@factbag/guards";

const kb = new KnowledgeBase();
const heldForOwner = predicate("held_for_owner", { company: String, owner: String });
const arrangementInForce = predicate("arrangement_in_force", { company: String });

const reviewerKB = guard(kb)
  .permit("assert", heldForOwner, arrangementInForce)
  .permit("deny", heldForOwner, arrangementInForce)
  .permit("query", heldForOwner)
  .block("deny", arrangementInForce);

const claim = heldForOwner({ company: "Harbor", owner: "Oriole" });
reviewerKB.asserts(claim, { source: "ownership-deed" });
reviewerKB.query(claim).value; // "true"

// Throws before writing: denying this predicate is blocked.
reviewerKB.denies(arrangementInForce({ company: "Harbor" }));
```

## Operations

- `asserts(atom, metadata?)` checks `assert` permission and returns the stored positive literal.
- `denies(atom, metadata?)` checks `deny` permission and returns the stored negative literal.
- `query(atom)` checks `query` permission and returns core's judgment for a ground atom.
- `queryAll(pattern)` checks `query` permission and returns core's matching judgments and bindings.

Forbidden operations throw an error naming the operation and predicate. Evidence,
metadata, and query results retain core's schema typing and semantics.

Query permission applies to the requested predicate. Evaluation uses the full KB,
including supporting predicates, and results retain their proofs. This is
operation control, not a filter over the underlying data. The public `kb` property
provides explicit access to the unrestricted underlying KB.

## Resolving permissions

Every form returns a readonly array of `{ operation, predicate }` grants:

```ts
reviewerKB.resolve();
reviewerKB.resolve("assert");
reviewerKB.resolve(heldForOwner);
reviewerKB.resolve(heldForOwner, arrangementInForce);
reviewerKB.resolve({
  operations: ["assert", "deny"],
  predicates: [heldForOwner],
});
```

- Nothing is permitted by default, even when the KB already contains facts.
- `assert`, `deny`, and `query` are independent operations.
- Any block overrides all permits for the same operation and predicate, regardless of order.
- Predicates are matched by object identity, not their names. They may be permitted before their first fact exists.
- Results contain each operation–predicate pair once, in first-permitted order.
- Wildcard grants resolve to the predicates the KB currently references. An
  operation wildcard expands to `assert`, `deny`, then `query`; a predicate
  wildcard expands in the KB's discovery order.
- Filters match any listed operation **and** any listed predicate. Omitted dimensions are unrestricted; empty arrays match nothing. Filters do not reorder results.

## Wildcards

`"*"` matches every operation in the first position and every predicate in the
rest, including predicates the KB first references after the grant.
`permit("*")` is shorthand for `permit("*", "*")`.

```ts
const trusted = guard(kb).permit("*"); // every operation, every predicate
const readOnly = guard(kb).permit("query", "*"); // query every predicate
const owners = guard(kb).permit("*", heldForOwner); // every operation on one predicate

// Declared after the grant, and still covered.
const beneficialOwner = predicate("beneficial_owner", { company: String, owner: String });
trusted.asserts(beneficialOwner({ company: "Harbor", owner: "Oriole" }));
```

Wildcards are evaluated when permissions are checked or resolved, not when they
are granted:

- Checks match any predicate, even one the KB has never referenced.
- `resolve()` expands a predicate wildcard to the predicates the KB currently
  references. A predicate appears once it has a fact or a rule.
- A predicate `"*"` stands alone. It cannot be combined with specific predicates
  in one call.
- Only the `permit("*")` and `block("*")` shorthand treats a missing predicate
  list as every predicate. With a specific operation, no predicates means none:
  `permit("assert")` grants nothing.

`block` accepts the same forms, and blocks still win regardless of order:

```ts
const reviewer = guard(kb).permit("*").block("deny", arrangementInForce);
const noWrites = guard(kb).permit("assert", heldForOwner).block("assert", "*");
```

A wildcard fails open: anything later added to the underlying KB becomes
reachable through the view, including through LLM tools built from it. Use it for
trusted or short-lived contexts, and prefer explicit predicates when the view
outlives the code that set it up.

## Immutable permissions, shared KB

`permit` and `block` return new views. Earlier views retain their permissions.
All branches share the original KB, so permitted writes are visible across them.

```ts
const readable = guard(kb).permit("query", heldForOwner);
const writable = readable.permit("assert", heldForOwner);

readable.resolve("assert"); // []
writable.asserts(claim);
readable.query(claim).value; // "true"
```

## Forking

`fork()` returns a view with the same permissions over a fork of the underlying
KB. The fork starts with the KB's current contents; later writes to either side
do not affect the other. Wildcards resolve against each KB separately.

```ts
const draft = reviewerKB.fork();
draft.asserts(claim);

reviewerKB.kb.literals(); // unchanged
draft.resolve(); // same grants as reviewerKB
```

Forking `kb` directly (`reviewerKB.kb.fork()`) returns an unrestricted
`KnowledgeBase`; permissions live on the view, not the KB.

## Public API

- `guard(kb)` creates an initially restricted `GuardedKB`.
- `GuardedKB` exposes `kb`, `permit`, `block`, `fork`, `resolve`, `asserts`, `denies`, `query`, and `queryAll`.
- `Operation`, `AllowedPermission`, and `PermissionFilter` describe operations, resolved grants, and combined filters.

## Commands

```sh
pnpm --filter @factbag/guards test
pnpm --filter @factbag/guards typecheck
```
