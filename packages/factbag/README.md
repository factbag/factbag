# Factbag

Experimental ESM library for explainable fact and rule evaluation, document
provenance, permission controls, and integration with TypeSafe AI’s Jev model.

```sh
npm install factbag@next
```

```ts
import { predicate } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { Corpus } from "factbag/corpus";
import { guard } from "factbag/guards";
import { classifier } from "factbag/jev/classifier";
```

Public entry points: `factbag/dsl`, `factbag/kb`, `factbag/query`,
`factbag/explain`, `factbag/corpus`, `factbag/guards`,
`factbag/jev/classifier`, `factbag/jev/resolve`, and `factbag/jev/errors`.
There is no root export. All four components are included in this package;
no separately installed `@factbag/*` packages or React are required.

Requires Node.js 22.18+ within Node 22, or Node 24 or 26. ESM only.
Declarations are checked with TypeScript 6 and 7. Browser and bundler support
are not part of this prerelease’s compatibility guarantee.

Jev uses `@typesafe-ai/sdk`; live requests require the service’s credentials.
Constructing classification or resolution jobs does not execute requests.

This is an experimental prerelease. APIs and serialized data may change.
See the [repository](https://github.com/factbag/factbag) for examples and guides.
