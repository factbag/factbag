import { describe, expect, it } from "vitest";
import { AssertionError } from "../assert";
import { assertIsAtom, assertIsGroundAtom, isAtom, isGroundAtom } from "./atom";
import type { Atom, GroundAtom } from "./atom";
import { assertIsCondition, isCondition } from "./condition";
import type { Condition } from "./condition";
import { assertIsEntityRef, isEntityRef } from "./entity";
import type { EntityRef } from "./entity";
import { assertIsEvidenceMetadata } from "./evidence-metadata";
import { assertIsExpression, isExpression } from "./expression";
import type { Expression } from "./expression";
import { assertIsKnowledgeBaseDocument, isKnowledgeBaseDocument } from "./knowledge-base";
import type { KnowledgeBaseDocument } from "./knowledge-base";
import { assertIsLiteral, isLiteral } from "./literal";
import type { Literal } from "./literal";
import { assertIsPredicate, isPredicate } from "./predicate";
import type { Predicate } from "./predicate";
import { assertIsRule, isRule } from "./rule";
import type { Rule } from "./rule";
import { assertIsTerm, isTerm } from "./term";
import type { Term } from "./term";
import { assertIsValue, isValue } from "./value";
import type { Value } from "./value";
import { assertIsVariable, isVariable } from "./variable";
import type { Variable } from "./variable";

const alice = { kind: "entity", type: "Person", id: "alice" } satisfies EntityRef;
const P = { kind: "var", name: "P" } satisfies Variable;
const T = { kind: "var", name: "T" } satisfies Variable;
const income = {
  kind: "atom",
  predicate: "income",
  fields: { person: P, amount: T },
} satisfies Atom;
const aliceIncome = {
  kind: "atom",
  predicate: "income",
  fields: { person: alice, amount: { kind: "number", value: "Infinity" } },
} satisfies GroundAtom;
const total = {
  kind: "sum",
  args: [T, income, { completeWhen: { kind: "not", atom: income } }],
} satisfies Expression;
const body = {
  kind: "and",
  args: [
    { kind: "exists", args: [T, income] },
    { kind: "letIn", args: [T, { kind: "add", args: [total, 1] }, { kind: "gte", args: [T, 2] }] },
  ],
} satisfies Condition;
const rule = { kind: "iff", head: income, body } satisfies Rule;
const literal = {
  kind: "literal",
  sign: "-",
  atom: aliceIncome,
  metadata: { source: "w2", scores: { probability: 0.9 }, annotations: { pages: [1, null] } },
} satisfies Literal;
const predicate = {
  kind: "predicate",
  name: "income",
  world: "open",
  params: {
    person: { kind: "entityType", type: "Person" },
    year: { kind: "enum", values: [2024, { kind: "date", value: "2025-01-01T00:00:00.000Z" }] },
    amount: "number",
  },
  metadata: { description: "Income.", parameters: { amount: "In dollars." } },
} satisfies Predicate;
const knowledgeBase = {
  apiVersion: "factbag/v1alpha1",
  kind: "KnowledgeBase",
  predicates: [predicate],
  entities: [alice],
  literals: [literal],
  rules: [rule],
} satisfies KnowledgeBaseDocument;

type Assert = (json: unknown) => void;

/**
 * Every shape's guard and assert: data each accepts, and departures each
 * rejects.
 */
const shapes: readonly Readonly<{
  shape: string;
  is: (json: unknown) => boolean;
  assert: Assert;
  accepts: readonly unknown[];
  rejects: readonly Readonly<{ name: string; json: unknown }>[];
}>[] = [
  {
    shape: "Value",
    is: isValue,
    assert: assertIsValue,
    accepts: [
      "text",
      0,
      false,
      alice,
      { kind: "number", value: "-Infinity" },
      { kind: "date", value: "2026-10-25T00:00:00.000Z" },
    ] satisfies Value[],
    rejects: [
      { name: "null", json: null },
      { name: "an array", json: [] },
      { name: "a bare infinity", json: Infinity },
      {
        name: "an unknown tag",
        json: { kind: "money", value: "1" },
      },
      {
        name: "a date-only string",
        json: { kind: "date", value: "2026-10-25" },
      },
      {
        name: "a date with an offset",
        json: { kind: "date", value: "2026-10-25T02:00:00+02:00" },
      },
      {
        name: "a finite number written as a tag",
        json: { kind: "number", value: "1" },
      },
    ],
  },
  {
    shape: "EntityRef",
    is: isEntityRef,
    assert: assertIsEntityRef,
    accepts: [alice],
    rejects: [
      {
        name: "a missing id",
        json: { kind: "entity", type: "Person" },
      },
      {
        name: "an empty class name",
        json: { kind: "entity", type: "", id: "a" },
      },
    ],
  },
  {
    shape: "Variable",
    is: isVariable,
    assert: assertIsVariable,
    accepts: [P],
    rejects: [
      {
        name: "a blank name",
        json: { kind: "var", name: " " },
      },
      { name: "a value", json: "P" },
    ],
  },
  {
    shape: "Term",
    is: isTerm,
    assert: assertIsTerm,
    accepts: [P, alice, 1] satisfies Term[],
    rejects: [{ name: "an atom", json: income }],
  },
  {
    shape: "Atom",
    is: isAtom,
    assert: assertIsAtom,
    accepts: [income, aliceIncome],
    rejects: [
      {
        name: "an atom without its kind",
        json: { predicate: "income", fields: {} },
      },
      {
        name: "a nested atom as a field",
        json: { ...income, fields: { person: income } },
      },
    ],
  },
  {
    shape: "GroundAtom",
    is: isGroundAtom,
    assert: assertIsGroundAtom,
    accepts: [aliceIncome],
    rejects: [
      {
        name: "an atom with a variable",
        json: income,
      },
    ],
  },
  {
    shape: "Predicate",
    is: isPredicate,
    assert: assertIsPredicate,
    accepts: [predicate, { kind: "predicate", name: "flagged", world: "closed", params: {} }],
    rejects: [
      {
        name: "an unknown world",
        json: { ...predicate, world: "ajar" },
      },
      {
        name: "an unknown field type",
        json: { ...predicate, params: { amount: "bigint" } },
      },
      {
        name: "an entity reference where an entity type belongs",
        json: { ...predicate, params: { person: alice } },
      },
      {
        name: "an enum listing a boolean",
        json: { ...predicate, params: { flag: { kind: "enum", values: [true] } } },
      },
      {
        name: "metadata without a description",
        json: { ...predicate, metadata: {} },
      },
    ],
  },
  {
    shape: "Literal",
    is: isLiteral,
    assert: assertIsLiteral,
    accepts: [literal, { kind: "literal", sign: "+", atom: aliceIncome }],
    rejects: [
      {
        name: "a negated atom from a rule body",
        json: { kind: "not", atom: aliceIncome },
      },
      {
        name: "evidence about a variable",
        json: { ...literal, atom: income },
      },
      {
        name: "an unknown sign",
        json: { ...literal, sign: "?" },
      },
      {
        name: "a score that is not a finite number",
        json: { ...literal, metadata: { scores: { probability: "high" } } },
      },
    ],
  },
  {
    shape: "Condition",
    is: isCondition,
    assert: assertIsCondition,
    accepts: [income, body, { kind: "not", atom: income }, { kind: "or", args: [] }],
    rejects: [
      {
        name: "an expression",
        json: { kind: "add", args: [1, 2] },
      },
      {
        name: "a comparison with one operand",
        json: { kind: "eq", args: [1] },
      },
      {
        name: "exists without a condition",
        json: { kind: "exists", args: [] },
      },
      {
        name: "exists quantifying over a value",
        json: { kind: "exists", args: [1, income] },
      },
      {
        name: "a malformed condition nested in a connective",
        json: { kind: "and", args: [income, { kind: "not", atom: 1 }] },
      },
    ],
  },
  {
    shape: "Expression",
    is: isExpression,
    assert: assertIsExpression,
    accepts: [1, T, total, { kind: "count", args: [T, income] }],
    rejects: [
      {
        name: "an aggregate without a condition",
        json: { kind: "sum", args: [T] },
      },
      {
        name: "aggregate options without completeWhen",
        json: { kind: "sum", args: [T, income, {}] },
      },
      {
        name: "arithmetic over a condition",
        json: { kind: "add", args: [1, income] },
      },
    ],
  },
  {
    shape: "Rule",
    is: isRule,
    assert: assertIsRule,
    accepts: [rule, { kind: "if", head: income, body: income }],
    rejects: [
      {
        name: "an unknown kind",
        json: { ...rule, kind: "unless" },
      },
      {
        name: "a body that is a value",
        json: { ...rule, body: true },
      },
    ],
  },
  {
    shape: "KnowledgeBaseDocument",
    is: isKnowledgeBaseDocument,
    assert: assertIsKnowledgeBaseDocument,
    accepts: [knowledgeBase],
    rejects: [
      {
        name: "another format version",
        json: { ...knowledgeBase, apiVersion: "factbag/v2" },
      },
      {
        name: "a rule among the evidence",
        json: { ...knowledgeBase, literals: [rule] },
      },
      {
        name: "a missing section",
        json: { ...knowledgeBase, rules: undefined },
      },
    ],
  },
];

describe.each(shapes)("$shape", ({ is, assert, accepts, rejects }) => {
  it("is recognised by its guard and assert, including after a trip through JSON text", () => {
    // Arrange: the conforming samples come from the shape's case.
    for (const sample of accepts) {
      const json: unknown = JSON.parse(JSON.stringify(sample));
      // Act / Assert
      expect(is(json)).toBe(true);
      expect(() => {
        assert(json);
      }).not.toThrow();
    }
  });

  it.each(rejects)("rejects $name", ({ json }) => {
    // Arrange: the departing data comes from the case.
    // Act / Assert
    expect(is(json)).toBe(false);
    expect(() => {
      assert(json);
    }).toThrow(AssertionError);
  });
});

describe("assertIsEvidenceMetadata", () => {
  it("accepts absent optional fields and rejects data JSON cannot hold", () => {
    // Arrange
    const absent = { source: undefined, annotations: { note: undefined } };
    const unrepresentable = { annotations: { when: new Date(0) } };
    // Act / Assert
    expect(() => {
      assertIsEvidenceMetadata(absent);
    }).not.toThrow();
    expect(() => {
      assertIsEvidenceMetadata(unrepresentable);
    }).toThrow(AssertionError);
  });
});
