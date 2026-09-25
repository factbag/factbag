# Reusable scenarios and examples

- [`scenarios`](./scenarios): `@factbag/scenarios` supplies fresh KBs, corpora, and
  independently authored expectations for examples and evals.
- [`jev`](./jev): `@factbag/jev-examples` consumes those scenarios in ordinary
  Vitest/MSW tests, using the default SDK client.

```sh
pnpm --filter @factbag/scenarios test
pnpm --filter @factbag/jev-examples test
```
