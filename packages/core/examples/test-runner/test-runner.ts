import { expect } from "vitest";
import { KnowledgeBase } from "../../src/knowledge-base";
import { query, queryAll, type QueryJudgment } from "../../src/query";
import { assertGroundAtom } from "../../src/types/atom";
import type { AnyAtom } from "../../src/types/atom";
import type { AnyLiteral } from "../../src/types/literal";
import type { AnyRule } from "../../src/types/rule";
import { normalizeToList } from "../../src/utils/normalize-to-list";
import type { OneOrMany } from "../../src/utils/normalize-to-list";

type ExpectedKnowledgeBase = Readonly<{
  literals: readonly AnyLiteral[];
  rules: readonly AnyRule[];
}>;

type ExpectedError = ErrorConstructor | (new (...args: never[]) => Error);

type ExpectedProofResult = Readonly<{
  /** Phase 2 expectation: literals and rules that should exist before solving. */
  expectedKnowledgeBase: ExpectedKnowledgeBase;

  /** Phase 4 expectation: proof-bearing query result or results. */
  expectedProofs: OneOrMany<QueryJudgment>;
}>;

type ExpectedErrorResult = Readonly<{
  /** Phase 2 expectation: literals and rules that should exist before solving. */
  expectedKnowledgeBase: ExpectedKnowledgeBase;

  /** Phase 4 expectation: exception raised while solving an invalid ruleset. */
  expectedError: ExpectedError;
}>;

type ExpectedBuildErrorResult = Readonly<{
  /** Phase 1 expectation: exception raised while building an invalid KB. */
  expectedBuildError: ExpectedError;
}>;

type ExpectedDslResult = ExpectedProofResult | ExpectedErrorResult;

type DslTestSpecBase = Readonly<{
  /** Short scenario name used by tests and failure output. */
  name: string;

  /** The semantic invariant this scenario must preserve. */
  invariant: string;

  /** Plain-language narration of the setup, query, and expected proof shape. */
  narration: string;

  /** Known implementation gap; run this spec as an expected failure. */
  fails?: string;

  /** Phase 3 input: atom or atoms to solve as query or queryAll. */
  queryAtoms: OneOrMany<AnyAtom>;
}>;

/**
 * A DSL-backed reasoning test case.
 *
 * Each spec follows the same lifecycle: build the KB through the public DSL,
 * verify the pre-solve KB structure, solve one or more query atoms, then compare
 * the resulting proof trees with the expected query results.
 */
type StaticDslTestSpecBuild = Readonly<{
  /** Phase 1: use the public DSL to populate the knowledge base. */
  build: (kb: KnowledgeBase) => void;
}>;

type StaticDslTestSpec =
  | (DslTestSpecBase & StaticDslTestSpecBuild & ExpectedDslResult)
  | (DslTestSpecBase & StaticDslTestSpecBuild & ExpectedBuildErrorResult);

type DynamicDslTestSpec<Handles = unknown> = DslTestSpecBase &
  Readonly<{
    /** Phase 1: use the public DSL to populate the knowledge base and return handles used by expectations. */
    build: (kb: KnowledgeBase) => Handles;

    /** Phase 2 and 4 expectations derived from handles returned by `build`. */
    expected: (handles: Handles) => ExpectedDslResult;
  }>;

export type DslTestSpec = StaticDslTestSpec | DynamicDslTestSpec;

/** Run the fixed DSL test lifecycle from build through proof comparison. */
export function runDslTestSpec(spec: DslTestSpec): void {
  const kb = new KnowledgeBase();

  if ("expectedBuildError" in spec) {
    expect(() => spec.build(kb)).toThrow(spec.expectedBuildError);
    return;
  }

  const handles = spec.build(kb);
  const expected =
    "expected" in spec
      ? spec.expected(handles)
      : "expectedError" in spec
        ? {
            expectedKnowledgeBase: spec.expectedKnowledgeBase,
            expectedError: spec.expectedError,
          }
        : {
            expectedKnowledgeBase: spec.expectedKnowledgeBase,
            expectedProofs: spec.expectedProofs,
          };

  assertExpectedKnowledgeBase(kb, expected.expectedKnowledgeBase);

  if ("expectedError" in expected) {
    expect(() => solveQuery(kb, spec.queryAtoms, [])).toThrow(expected.expectedError);
    return;
  }

  const actualProofs = solveQuery(kb, spec.queryAtoms, expected.expectedProofs);
  assertExpectedProofs(actualProofs, expected.expectedProofs);
}

/** Phase 2: compare the built KB's pre-solve literals and rules to expectation. */
function assertExpectedKnowledgeBase(kb: KnowledgeBase, expected: ExpectedKnowledgeBase): void {
  expect(kb.literals()).toEqual(expected.literals);
  expect(kb.rules()).toEqual(expected.rules);
}

/** Phase 3: solve the query atom as query or queryAll based on expected shape. */
function solveQuery(
  kb: KnowledgeBase,
  queryAtoms: OneOrMany<AnyAtom>,
  expected: OneOrMany<QueryJudgment>,
): OneOrMany<QueryJudgment> {
  const atoms = normalizeToList(queryAtoms);
  const expectsMany = Array.isArray(expected);

  if (atoms.length === 1) {
    const atom = atoms[0];
    if (atom === undefined) {
      throw new Error("Expected one query atom");
    }
    if (expectsMany) {
      return queryAll(kb, atom);
    }
    assertGroundAtom(atom);
    return query(kb, atom);
  }

  if (!expectsMany) {
    throw new Error("Multiple query atoms require multiple expected proofs");
  }

  return atoms.map((atom) => {
    assertGroundAtom(atom);
    return query(kb, atom);
  });
}

/** Phase 4: compare actual query results, including proof trees, to expectation. */
function assertExpectedProofs(
  actual: OneOrMany<QueryJudgment>,
  expected: OneOrMany<QueryJudgment>,
): void {
  expect(actual).toEqual(expected);
}
