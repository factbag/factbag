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
