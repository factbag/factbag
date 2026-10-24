# false-candidates: declarative regression example

Branch: `danieldup/test/core-false-candidates`. Base: `origin/main`. Corresponding fix: `ee25f12`.

This change contains examples only. The `fails` field uses the existing harness's
expected-failure convention; remove that field when implementing the fix.
The examples assert the pre-solve facts and rules and the query's value, atom,
bindings and rule support. They deliberately do not freeze internal temporary
variables or the complete proof tree. The enumeration example asserts an empty
result list.

Validation: run as ordinary tests, these cases fail at `ee25f12^` and pass at
`ee25f12`. They also pass against the complete SARA core fixes at `b9dce5c`.

This example independently reproduces on main (`068576d`). No other example
branch or production-code change is required to reproduce it.

Run the registered expected-failure suite with:

```sh
pnpm --filter @factbag/core test:examples
```

For an ordinary failing test, temporarily remove the example's `fails` field and
run the same command. A passing expected-failure test means the reproduction is
still broken, not that it has been fixed.
