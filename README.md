# Factbag

A TypeScript library for combining evidence with explicit rules in a knowledgebase.
Facts can be true, false, conflicted, or unknown. Query results keep track of the
sources and rules behind a conclusion.

Factbag includes a document corpus, permission controls, and an integration with
TypeSafe AI’s Jev model.

Read [Introducing Factbag](https://blog.du-pless.is/introducing-factbag) for how and
why to use it, or [Jev and the Art of Truth Maintenance](https://blog.du-pless.is/jev-and-the-art-of-truth-maintenance)
for the thinking behind it.

## Install

```sh
npm install factbag@next
```

ESM only. Requires Node 22.18+ on the 22.x line, or Node 24 or 26.
This is an early prerelease; APIs may change.

## Example

```ts
import { predicate, variable } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { query } from "factbag/query";

const emailVerified = predicate("email_verified", { user: String });
const canSignIn = predicate("can_sign_in", { user: String });
const user = variable("user");
const kb = new KnowledgeBase();

kb.rule(canSignIn({ user })).if(emailVerified({ user }));
kb.asserts(emailVerified({ user: "alice" }), { source: "accounts" });

query(kb, canSignIn({ user: "alice" })).value; // "true"
```

For Jev, also install `@typesafe-ai/sdk@^0.6.0`. Other parts of Factbag do not
require it. Live Jev requests need a TypeSafe API key.

Apache-2.0 licensed.
