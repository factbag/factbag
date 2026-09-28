# Factbag

Start with [Fix one fact, not the whole answer](packages/jev/docs/README.md):
a walkthrough of reading documents with Jev, reviewing conflicting evidence,
and reaching a decision you can inspect.

Run the credential-free walkthrough:

```sh
pnpm --filter @factbag/jev demo
```

Reusable J-1 and OFAC scenario factories, plus test-based Jev examples, live in
[`examples/`](examples/README.md). The same corpora and native evidence annotations
can be consumed by evals.

## Local Development

Prerequisites:

- Node.js `>=22.18.0`
- pnpm `11.27.1`

```bash
pnpm install
```

The live Jev demo needs an API key; the walkthrough above does not.

```bash
cp .env.example .env   # then set TYPESAFE_API_KEY
pnpm --filter @factbag/jev-examples demo
```

## Common Commands

```bash
pnpm build
pnpm lint
pnpm test
pnpm typecheck
pnpm format
```

## Package Artifacts

The public packages are built as bundled ESM with tsup. Each package is built from
all of its public entry points in one invocation so shared runtime definitions remain
shared chunks, while sibling Factbag packages and third-party dependencies remain
external. This keeps the documented package subpaths intact without exposing the
repository's internal module layout.

Bundling also makes every generated relative import a complete `.js` path that native
Node can resolve. The same standards-based ESM output works in modern bundlers without
requiring consumers to enable TypeScript or bundler-specific module resolution.
Declarations are generated for each public entry point and checked by API Extractor.
Builds clean `dist` first and intentionally include source maps for useful production
stack traces. After building, `pnpm build:verify` imports every public entry with native
Node, validates generated relative imports, and type-checks a NodeNext consumer against
the emitted declarations.
