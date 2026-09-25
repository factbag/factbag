/**
 * Asserts every declarative DSL example against its expected knowledge-base
 * state and proof output, while preserving expected-fail DOD examples.
 */
import { describe, it } from "vitest";
import { testCases } from "./test-cases";
import { runDslTestSpec } from "./test-runner/test-runner";

describe("DSL example test cases", () => {
  for (const testCase of testCases) {
    const runTest = testCase.fails === undefined ? it : it.fails;

    runTest(testCase.name, () => {
      runDslTestSpec(testCase);
    });
  }
});
