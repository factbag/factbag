# Core testing

Prefer declarative examples in `examples/test-cases/` for reasoning behavior.
Register them in `examples/test-cases/index.ts` and use the existing runner to
exercise DSL → knowledge base → query/queryAll.

- Cover grounded queries and variable enumeration where relevant. Include
  successful controls alongside rejected values or failed paths.
- Assert relevant proof support and bindings. Avoid depending on arithmetic
  temporary names or unrelated intermediate proof structure.
- Keep public-API integration tests for contracts the example lifecycle cannot
  express, such as evidence mutation, fork isolation, rejected-insertion state,
  and explanation rendering. Do not expand the runner merely to relocate a test.
- Avoid duplicate example and focused-test setups. Before removing a focused
  test, preserve every distinct behavior it checks in the replacement examples.
- Verify regressions without the fix and confirm the intended failure, then
  verify they pass with it. `fails` marks a known gap; a green expected-failure
  test alone does not establish that it failed for the right reason.

Follow the general testing guidance in
[`skills/test-writer/SKILL.md`](../../skills/test-writer/SKILL.md).
