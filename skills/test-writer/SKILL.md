---
name: test-writer
description: Write and revise Factbag tests. Use when adding coverage, reproducing bugs, testing new behavior, or reviewing tests.
---

# Write tests

Test meaningful behavior and regressions through a module's exported interface.

## Boundaries

- Exercise exports, not private helpers or state. Module exports need not be
  published package entrypoints.
- Do not export internals solely for testing.
- Assert observable results, errors, or effects—not implementation details.
- Keep internal collaborators real; mock external boundaries when necessary.
- Write tests that survive internal refactors when behavior is unchanged.

## Location and names

- Colocate unit tests: `classifier.ts` → `classifier.test.ts`.
- Follow existing layouts for cross-module, type-level, and package-consumer tests.
- Name `describe` after the exported symbol or interface, such as `Corpus.resolve`.
- Name `it` after the expected behavior, such as
  `"returns the passage identified by a source ID"`.
- Give parameterized cases descriptive names.

## Structure

Use explicit phase comments in each test:

```ts
describe("ExportedSymbol", () => {
  it("describes the observable behavior", () => {
    // Arrange
    // Act
    // Assert
  });
});
```

Keep one coherent behavior per test; multiple assertions are fine.
When setup comes from fixtures or parameters, identify that in Arrange.

If the purpose is not obvious, add a short `/** ... */` comment above the test
explaining why the case matters—not paraphrasing its assertions.

## Assertions and isolation

- Identify the plausible bug each test would catch.
- Derive expected values independently; do not repeat implementation logic.
- Prefer precise assertions over weak existence checks.
- Assert exact wording or dependency calls only when part of the contract.
- Avoid source-text checks and blindly updated snapshots.
- Control time, randomness, network access, and resources; avoid arbitrary sleeps.
- Keep tests independent and clean up their resources.

## Verification

Read nearby tests and use the installed framework and repository commands.
Choose runtime, type-level, or integration tests according to the contract.

Run changed tests and relevant surrounding tests. For regressions, write the test
first and run it against the buggy code. Confirm it fails for the expected reason
(red), then fix the implementation and confirm it passes (green). Report failures
and unverified checks; do not weaken assertions to obtain a pass.

Apply these conventions to new or substantially changed tests, without unrelated
rewrites.
