# @factbag/core

Core TypeScript runtime and DSL for building small fact/rule knowledge bases.

## What it provides

- `KnowledgeBase` for storing evidence and rules.
- Predicate and variable helpers for defining facts and queries.
- Solver APIs that return proof-bearing judgments.
- Explanation helpers for inspecting how a judgment was reached.

## Basic usage

```ts
import { predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";

class Person {
  constructor(readonly id: string) {}
}

const hasAccount = predicate("has_account", { person: Person });

const kb = new KnowledgeBase();
const alice = new Person("alice");

kb.entities.add(alice);
kb.asserts(hasAccount({ person: alice }));

const judgment = kb.query(hasAccount({ person: alice }));
console.log(judgment.value);
```

## Candidate enumeration

`queryAll` discovers candidates from stored evidence and rule bodies. A rule body
that evaluates to `false` does not introduce a candidate. For example, if Alice
is an applicant but lacks required closed-world approval, a rule defining
eligibility from both facts will not enumerate Alice as eligible.

A grounded `query` for Alice's eligibility still returns `false` with its proof.
Candidates from explicit evidence (including denials), other supporting rules,
and `unknown` or `conflicted` rule bodies remain discoverable. Consequently,
`queryAll` is not a filter that returns only true judgments, nor does it enumerate
every possible false proposition.

## Predicate guidance and evidence annotations

An optional third argument to `predicate` or `closedPredicate` describes the
predicate for evidence producers such as `@factbag/jev`:

```ts
const hasAccount = predicate(
  "has_account",
  { person: Person },
  {
    description: "The person currently has an open account.",
    instructions: "An application alone does not establish that an account exists.",
    parameters: { person: "The account holder." },
  },
);

kb.asserts(hasAccount({ person: alice }), {
  source: "account-register",
  scores: { probability: 0.91 },
  annotations: { review: { status: "pending" } },
});
```

Evidence metadata accepts general named numeric `scores` and JSON-compatible
`annotations`. These stay attached to the supporting literals in query judgments;
core does not interpret or propagate them. Predicate guidance describes the shared
declaration, while evidence scores describe a particular source's assertion or denial.

## Commands

```sh
pnpm --filter @factbag/core test
pnpm --filter @factbag/core test:examples
pnpm --filter @factbag/core lint
pnpm --filter @factbag/core typecheck
```
