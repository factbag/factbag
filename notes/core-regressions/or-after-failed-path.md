# or-after-failed-path: declarative regression example

Branch: `danieldup/test/core-or-after-failed-path`. Base: `41ab0cf^`. Corresponding fix: `41ab0cf`.

This change contains examples only. The `fails` field uses the existing harness's
expected-failure convention; remove that field when implementing the fix.
The examples assert the pre-solve facts and rules and the query's value, atom,
bindings and rule support. They deliberately do not freeze internal temporary
variables or the complete proof tree. The enumeration example asserts an empty
result list.

Validation: run as ordinary tests, these cases fail at `41ab0cf^` and pass at
`41ab0cf`. They also pass against the complete SARA core fixes at `b9dce5c`.

This is a follow-on regression: the example passes on current `main`, but fails
on this branch's pre-fix base. Keep it with the prerequisite solver work rather
than opening a PR against main that includes the intervening SARA history.

Run the registered expected-failure suite with:

```sh
pnpm --filter @factbag/core test:examples
```

For an ordinary failing test, temporarily remove the example's `fails` field and
run the same command. A passing expected-failure test means the reproduction is
still broken, not that it has been fixed.
